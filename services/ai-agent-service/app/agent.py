"""Minimal tool-calling agent loop.

We use the OpenAI client because OpenAI, Azure OpenAI, and many open-source
inference servers (Together, OpenRouter, vLLM) speak the same wire format.
If LLM_API_KEY is not set we run a deterministic 'rule-based' agent so the
demo still works without external credentials.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from openai import OpenAI

from .config import get_settings
from .tools import DISPATCH, TOOL_SCHEMAS, apply_to_job, create_alert, search_jobs

log = logging.getLogger(__name__)
settings = get_settings()

SYSTEM_PROMPT = (
    "You are a smart job-search assistant for a Turkish job board (kariyer.net-style).\n"
    "You have access to tools and MUST use them — never make up job results.\n\n"
    "## Tool usage rules\n"
    "1. **search_jobs** first whenever the user asks about jobs or you need job IDs.\n"
    "2. **get_job_details** when the user asks for more info about a specific job.\n"
    "3. **apply_to_job** after search (or get_job_details) when the user wants to apply.\n"
    "   - Always confirm which job before applying.\n"
    "   - If login_required returned, tell the user to log in.\n"
    "4. **create_alert** when the user asks to be notified about new jobs (‘alarm kur’, ‘haber ver’, ‘notify me’).\n"
    "   - Extract keywords + optional city/work_preference from context.\n"
    "5. **list_alerts** when the user asks to see their existing alerts.\n\n"
    "## Response style\n"
    "- Reply in the SAME language as the user (Turkish or English).\n"
    "- Keep replies concise and structured (bullet points where helpful).\n"
    "- Always cite the job **id** when listing jobs so the UI can render an Apply button.\n"
    "- After applying successfully, confirm with the job title."
)


# Values we treat as "no real key" so we don't make a doomed API call.
_PLACEHOLDER_KEYS = {"", "replace-me", "your-key-here", "change-me", "todo"}


def _llm_client() -> OpenAI | None:
    key = (settings.LLM_API_KEY or "").strip()
    if key.lower() in _PLACEHOLDER_KEYS:
        return None
    return OpenAI(api_key=key, base_url=settings.LLM_BASE_URL)


async def _try_llm(messages: list[dict], bearer_token: str | None, client: OpenAI) -> dict:
    """Run the LLM tool-calling loop. Raises on any error."""
    convo = [{"role": "system", "content": SYSTEM_PROMPT}, *messages]
    suggested_jobs: list[dict] = []

    for _ in range(4):  # max 4 tool-call rounds
        completion = client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=convo,
            tools=TOOL_SCHEMAS,
            tool_choice="auto",
            temperature=0.2,
        )
        msg = completion.choices[0].message
        if not msg.tool_calls:
            return {"reply": msg.content or "", "jobs": suggested_jobs}

        convo.append(msg.model_dump())
        for call in msg.tool_calls:
            args = json.loads(call.function.arguments or "{}")
            try:
                result = await DISPATCH[call.function.name](args, bearer_token)
            except Exception as e:  # noqa: BLE001
                result = {"error": str(e)}
            if call.function.name == "search_jobs" and isinstance(result, dict):
                suggested_jobs = result.get("items") or suggested_jobs
            convo.append(
                {
                    "role": "tool",
                    "tool_call_id": call.id,
                    "content": json.dumps(result, default=str),
                }
            )

    return {"reply": "Sorry, I couldn't complete the request.", "jobs": suggested_jobs}


async def chat(messages: list[dict], bearer_token: str | None = None) -> dict:
    """Returns {reply: str, jobs: list}. Always succeeds — never raises."""
    client = _llm_client()
    if client is None:
        return await _rule_based(messages, bearer_token)
    try:
        return await _try_llm(messages, bearer_token, client)
    except Exception as e:  # noqa: BLE001
        # Bad key, network down, model deprecated, whatever — never break the chat.
        log.warning("LLM call failed (%s) — falling back to rule-based agent.", e)
        return await _rule_based(messages, bearer_token)


# ------------------------------------------------------------------
# Fallback rule-based agent (no LLM key needed) – very small but covers
# the demo flow shown in the assignment.
# ------------------------------------------------------------------

CITY_RE = re.compile(
    r"\b(istanbul|izmir|ankara|bursa|antalya|adana|konya|kayseri|eskişehir|"
    r"gaziantep|şanlıurfa|kocaeli|mersin|diyarbakır|trabzon|malatya|erzurum|"
    r"samsun|sakarya|tekirdağ|balıkesir|manisa|aydın|muğla|denizli|bolu|"
    r"çanakkale|edirne|zonguldak|isparta|burdur|afyon|aksaray|batman|siirt)\b",
    re.I,
)
ROLE_RE = re.compile(
    r"\b(web\s+developer|frontend|back.?end|full.?stack|"
    r"yaz[ıi]l[ıi]m\s+(?:uzman[ıi]?|m[üu]hendis[i]?|geli[şs]tirici|developer)|"
    r"programc[ıi]|developer|engineer|m[üu]hendis|"
    r"python|java(?:script)?|typescript|react|vue|angular|node(?:\.?js)?|"
    r"veri\s+analiz(?:t[ıi])?|data\s+analy(?:st|tics|sis|zer)|data\s+engineer|"
    r"makine\s+[öo][ğg]renme|machine\s+learning|yapay\s+zeka|ai\s+engineer|ml\s+engineer|"
    r"devops|sre|cloud|aws|azure|gcp|kubernetes|docker|"
    r"mobil|mobile|ios|android|flutter|kotlin|swift|"
    r"ux|ui|tasar[ıi]mc[ıi]?|"
    r"proje\s+y[öo]netici|product\s+manager|"
    r"seo|pazarlama|digital\s+marketing|"
    r"muhasebe|finans|finance|accounting|"
    r"[ıi]nsan\s+kaynaklar[ıi]|hr|human\s+resource|"
    r"sat[ıi]ş|sales|"
    r"i[şs]\s+analiz(?:t[ıi])?|business\s+analyst|"
    r"siber\s+g[üu]venlik|security|cyber)\b",
    re.I,
)

WORK_PREF_RE = re.compile(
    r"\b(uzaktan|uzak\s+(?:çalış\w*|iş)|remote|"
    r"hibrit|hybrid|karma\s*(?:çalış\w*)?|"
    r"ofis(?:te|ten)?|onsite|on.?site|yerinde)\b",
    re.I,
)
LEVEL_RE = re.compile(
    r"\b(junior|jr\.?|yeni\s+mezun|entry.?level|"
    r"mid.?(?:level|senior)?|orta\s+seviy\w*|"
    r"senior|sr\.?|k[ıi]demli|"
    r"lead|lider|principal|staff|"
    r"manager|m[üu]d[üu]r|y[öo]netici)\b",
    re.I,
)

_GREET_RE = re.compile(
    r"^[\s]*(merhaba|selam|hello|hi|hey|günaydın|iyi\s+günler|nasılsın)[!.\s?]*$",
    re.I,
)
_THANKS_RE = re.compile(
    r"\b(teşekkür(?:ler)?|sağol|thank(?:s|\s+you)|çok\s+iyi|harika|süper|mükemmel)\b",
    re.I,
)
_HELP_RE = re.compile(
    r"\b(yardım\s*[?!]?|nasıl\s+kullan\w*|ne\s+(?:yapabilir|yaparsın)\w*|"
    r"neler\s+yapabilir\w*|help\s*[?!]?|what\s+can\s+you|how\s+do\s+i)\b",
    re.I,
)
_MORE_RE = re.compile(
    r"\b(daha\s+fazla(?:s[ıi])?|daha\s+çok|başka\s+ilan(?:lar)?|more\s+(?:jobs|results?)|"
    r"devam\s+et|show\s+more|hepsini\s+göster|tümünü\s+göster)\b",
    re.I,
)
_ALERT_RE = re.compile(
    r"\b(alarm\s+kur|iş\s+alarm[ıi]|alert|bildirim\s+kur|haber\s+ver|notify\s+me|hatırlat)\b",
    re.I,
)
_APPLY_RE = re.compile(
    r"\b(başvur(?:mak\s+istiyorum|ayım|dum|alım|sun)?|apply(?:\s+to\s+this)?|"
    r"bu\s+(?:ilana?|işe?)\s*başvur|bunu\s+başvur)\b",
    re.I,
)
# Matches embedded job-id markers written by _format_bullets: ⟨job:UUID⟩
_JOB_ID_RE = re.compile(r"⟨job:([0-9a-f\-]{36})⟩", re.I)


def _extract_work_pref(text: str) -> str | None:
    m = WORK_PREF_RE.search(text)
    if not m:
        return None
    w = m.group(0).lower()
    if re.search(r"uzak|remote", w):
        return "remote"
    if re.search(r"hibrit|hybrid|karma", w):
        return "hybrid"
    if re.search(r"ofis|onsite|yerinde", w):
        return "onsite"
    return None


def _format_bullets(items: list[dict]) -> str:
    pref_labels = {"remote": "🌐 Uzaktan", "hybrid": "🔄 Hibrit", "onsite": "🏢 Ofis"}
    lines = []
    for j in items:
        pref = pref_labels.get(j.get("work_preference") or "", "")
        co = j.get("company") or ""
        ct = j.get("city") or ""
        meta = [x for x in [co, ct, pref] if x]
        # Embed job ID as hidden marker so apply intent can recover it
        lines.append(f"• **{j['title']}** — {' · '.join(meta)} ⟨job:{j['id']}⟩")
    return "\n".join(lines)


def _criteria_label(
    role: str | None, city: str | None, work_pref: str | None, level: str | None
) -> str:
    pref_tr = {"remote": "uzaktan", "hybrid": "hibrit", "onsite": "ofis"}
    parts = []
    if level:
        parts.append(level.capitalize())
    if role:
        parts.append(role)
    if city:
        parts.append(city.title())
    if work_pref:
        parts.append(pref_tr.get(work_pref, work_pref))
    return " · ".join(parts) if parts else "genel arama"


async def _rule_based(messages: list[dict], bearer_token: str | None = None) -> dict:
    # Last user message → intent detection
    last_user = next(
        (m.get("content", "") for m in reversed(messages) if m.get("role") == "user"),
        "",
    )
    # All user messages → entity extraction (context-aware across turns)
    all_user = " ".join(m.get("content", "") for m in messages if m.get("role") == "user")
    num_turns = sum(1 for m in messages if m.get("role") == "user")

    # ── Intent: greeting ──────────────────────────────────────────
    if _GREET_RE.match(last_user.strip()):
        return {
            "reply": (
                "Merhaba! 👋 Ben Staff Agent — iş aramanda yardımcı olabilirim.\n\n"
                "Şunları yapabilirim:\n"
                "🔍 Pozisyon, şehir ve çalışma tercihine göre ilan ara\n"
                "📋 İlan detaylarını getir\n"
                "🔔 İş alarmı kurmana yönlendiririm\n\n"
                "Örnek: \"İstanbul'da uzaktan React developer\" ya da \"Ankara'da senior backend\""
            ),
            "jobs": [],
        }

    # ── Intent: thanks ────────────────────────────────────────────
    if _THANKS_RE.search(last_user):
        return {
            "reply": "Ne demek, yardımcı olabildiysem ne mutlu! 😊\n\nBaşka bir ilan aramak ister misin?",
            "jobs": [],
        }

    # ── Intent: help (no search entities in same message) ─────────
    if _HELP_RE.search(last_user) and not (
        ROLE_RE.search(last_user) or CITY_RE.search(last_user)
    ):
        return {
            "reply": (
                "İşte neler yapabilirim:\n\n"
                "🔍 **İş arama** — \"İzmir'de frontend developer\" veya \"uzaktan yazılım mühendisi\"\n"
                "📋 **İlan detayı** — Gösterdiğim ilanlara tıklayarak detay sayfasına geçebilirsin\n"
                "🔔 **İş alarmı** — Arama sayfasından kriter belirleyip alarm kurabilirsin\n"
                "🏢 **Çalışma tercihi** — Uzaktan, hibrit veya ofis filtreleyebilirsin\n\n"
                "Neyle başlamak istersin?"
            ),
            "jobs": [],
        }

    # ── Intent: apply ─────────────────────────────────────────────
    if _APPLY_RE.search(last_user):
        # Try to recover a job ID from recent assistant messages
        recent_job_id: str | None = None
        for m in messages:
            if m.get("role") == "assistant":
                found = _JOB_ID_RE.findall(m.get("content", ""))
                if found:
                    recent_job_id = found[-1]  # last mentioned job
        if recent_job_id and bearer_token:
            result = await apply_to_job(job_id=recent_job_id, bearer_token=bearer_token)
            if result.get("ok"):
                return {
                    "reply": (
                        "✅ **Başvurun alındı!** İyi şanslar 🍀\n\n"
                        "Başka ilan aramak ister misin?"
                    ),
                    "jobs": [],
                }
            if result.get("reason") == "login_required":
                return {
                    "reply": "🔒 Başvurmak için **giriş yapman** gerekiyor. Sağ üst köşeden giriş yapabilirsin.",
                    "jobs": [],
                }
        if not bearer_token:
            return {
                "reply": "🔒 Başvurmak için önce **giriş yapman** gerekiyor. Sağ üst köşeden giriş yapabilirsin.",
                "jobs": [],
            }
        return {
            "reply": (
                "Aşağıdaki ilan kartlarındaki **Başvur** butonuna basarak doğrudan başvurabilirsin! 🍀\n\n"
                "Hangi ilana başvurmak istiyorsun? İlan adını yazar veya yukarıdaki bir kartı seçebilirsin."
            ),
            "jobs": [],
        }

    # ── Intent: alert ─────────────────────────────────────────────
    if _ALERT_RE.search(last_user):
        # Try to extract criteria for a direct API-backed alert
        a_city_m = CITY_RE.search(all_user)
        a_role_m = ROLE_RE.search(all_user)
        a_wp     = _extract_work_pref(all_user)
        if bearer_token and (a_role_m or a_city_m or a_wp):
            a_keywords  = a_role_m.group(0) if a_role_m else None
            a_city      = a_city_m.group(0).capitalize() if a_city_m else None
            result = await create_alert(
                keywords=a_keywords or "",
                city=a_city,
                work_preference=a_wp,
                bearer_token=bearer_token,
            )
            if result.get("ok"):
                criteria = _criteria_label(a_keywords, a_city, a_wp, None)
                return {
                    "reply": (
                        f"✅ **İş alarmı kuruldu!** {criteria} için yeni ilan çıktığında bildirim alacaksın. 🔔\n\n"
                        "Alarmlarını **İş Alarmı** sayfasından yönetebilirsin."
                    ),
                    "jobs": [],
                }
        # Not logged in or no criteria → guide to UI
        if not bearer_token:
            return {
                "reply": (
                    "🔔 İş alarmı kurmak için önce **giriş yapman** gerekiyor.\n\n"
                    "Giriş yaptıktan sonra tekrar sor veya üst menüden İş Alarmı sayfasına git."
                ),
                "jobs": [],
            }
        return {
            "reply": (
                "İş alarmı kurmak için:\n\n"
                "1. Üst menüden **İş Alarmı** sayfasına git\n"
                "2. Pozisyon, şehir ve çalışma tercihini belirle\n"
                "3. Kaydet — yeni ilan çıktığında bildirim alacaksın!\n\n"
                "Veya bana hangi pozisyonu takip etmek istediğini söyle, hemen kurayım."
            ),
            "jobs": [],
        }

    # ── Entity extraction — smart context merging ─────────────────
    # Prefer last message; fall back to history only for specific cases.
    city_m   = CITY_RE.search(last_user)
    role_m   = ROLE_RE.search(last_user)
    level_m  = LEVEL_RE.search(last_user)
    wp_last  = _extract_work_pref(last_user)

    if role_m or city_m or wp_last:
        # Last message carries its own search intent.
        # Inherit only the entities MISSING from last message so that
        # "full stack için hangi şehirler" doesn't bleed İzmir from earlier.
        if not city_m:
            # No city in last msg → start fresh (user explicitly left city open)
            city = None
        else:
            city = city_m.group(0).capitalize()

        role       = role_m.group(0) if role_m else None
        level      = level_m.group(0) if level_m else None
        work_pref  = wp_last

        # If this message has a city but no role, carry over role from history
        if city_m and not role_m:
            hist_role = ROLE_RE.search(all_user)
            role      = hist_role.group(0) if hist_role else None
            hist_lvl  = LEVEL_RE.search(all_user)
            level     = hist_lvl.group(0) if hist_lvl else None
            if not work_pref:
                work_pref = _extract_work_pref(all_user)
    else:
        # Pure continuation message ("peki?", "tamam", "devam et" …)
        # → fall back to full history for all entities.
        city_m    = CITY_RE.search(all_user)
        city      = city_m.group(0).capitalize() if city_m else None
        role_m    = ROLE_RE.search(all_user)
        role      = role_m.group(0) if role_m else None
        level_m   = LEVEL_RE.search(all_user)
        level     = level_m.group(0) if level_m else None
        work_pref = _extract_work_pref(all_user)

    position_query: str | None = None
    if level and role:
        position_query = f"{level} {role}"
    elif role:
        position_query = role

    # ── Intent: more results ──────────────────────────────────────
    if _MORE_RE.search(last_user):
        res = await search_jobs(
            position=position_query, city=city, work_preference=work_pref, page_size=10
        )
        items = res.get("items", [])
        if items:
            bullets = _format_bullets(items[:10])
            return {
                "reply": f"İşte daha fazla ilan 👇\n\n{bullets}\n\nDetay için ilan adını sor.",
                "jobs": items,
            }

    # ── Intent: search ────────────────────────────────────────────
    if position_query or city or work_pref:
        res = await search_jobs(position=position_query, city=city, work_preference=work_pref)
        items = res.get("items", [])
        criteria = _criteria_label(role, city, work_pref, level)
        if not items:
            return {
                "reply": (
                    f"Üzgünüm, **{criteria}** için uygun ilan bulamadım. 😔\n\n"
                    "Farklı bir pozisyon, şehir veya çalışma tercihi dener misin?"
                ),
                "jobs": [],
            }
        bullets = _format_bullets(items[:5])
        suffix = "\n\nDetay görmek için ilan adını sor, başvurmak için ilanda 'Başvur' butonuna bas."
        if len(items) > 5:
            suffix += " «Daha fazla göster» yazabilirsin."
        return {
            "reply": f"**{criteria}** için {len(items)} ilan buldum 👇\n\n{bullets}{suffix}",
            "jobs": items,
        }

    # ── Fallback: clarification ───────────────────────────────────
    if num_turns > 1:
        return {
            "reply": (
                "Tam anlayamadım. Şunlardan birini belirtir misin?\n\n"
                "• **Pozisyon**: Hangi alanda iş arıyorsun? (örn. frontend, veri analisti, DevOps)\n"
                "• **Şehir**: Nerede çalışmak istersin? (örn. İstanbul, İzmir, Ankara)\n"
                "• **Tercih**: Uzaktan mı, hibrit mi, yoksa ofiste mi?"
            ),
            "jobs": [],
        }

    return {
        "reply": (
            "Merhaba! 👋 Hangi pozisyonda iş arıyorsun?\n\n"
            "Örneğin:\n"
            "• \"İstanbul'da senior React developer\"\n"
            "• \"Uzaktan backend engineer\"\n"
            "• \"Ankara'da junior veri analisti\""
        ),
        "jobs": [],
    }
