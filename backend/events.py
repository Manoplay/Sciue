import re
from datetime import date
from email.utils import parsedate_to_datetime

import feedparser


MONTHS_IN_ITALIAN = (
    "gennaio",
    "febbraio",
    "marzo",
    "aprile",
    "maggio",
    "giugno",
    "luglio",
    "agosto",
    "settembre",
    "ottobre",
    "novembre",
    "dicembre",
)


def _published_date(entry):
    published = entry.get("published") or entry.get("updated")
    if published:
        try:
            return parsedate_to_datetime(published).date()
        except (TypeError, ValueError):
            pass

    parsed = entry.get("published_parsed") or entry.get("updated_parsed")
    if parsed:
        return date(parsed.tm_year, parsed.tm_mon, parsed.tm_mday)

    return None


def _entry_text(entry):
    text_parts = [
        entry.get("title", ""),
        entry.get("summary", ""),
        entry.get("description", ""),
    ]
    text_parts.extend(
        content.get("value", "")
        for content in entry.get("content", [])
        if isinstance(content, dict)
    )
    return " ".join(str(part) for part in text_parts if part).casefold()


def _contains_today_date(text, today):
    day_month = today.strftime("%d/%m")
    numeric_date = rf"(?<!\d){re.escape(day_month)}(?!\d)"
    month_name = MONTHS_IN_ITALIAN[today.month - 1]
    day = rf"(?:{today.day}|{today.day:02d})"
    named_date = rf"(?<!\d){day}\s+{month_name}(?!\w)"
    return bool(re.search(numeric_date, text) or re.search(named_date, text))


def get_valid_articles(entries, today=None):
    """Return articles published today or relevant articles published yesterday."""
    today = today or date.today()
    yesterday = today.fromordinal(today.toordinal() - 1)
    valid_articles = []

    for entry in entries:
        published_date = _published_date(entry)
        if published_date == today:
            valid_articles.append(entry)
            continue

        if published_date is None or published_date > today:
            continue

        text = _entry_text(entry)
        if _contains_today_date(text, today) or (
            published_date == yesterday and re.search(r"\bdomani\b", text)
        ):
            valid_articles.append(entry)

    return valid_articles


d = feedparser.parse("https://www.comune.napoli.it/feed/?post_type=notizia")
valid_articles = get_valid_articles(d.entries)

# https://www.comune.napoli.it/feed/?post_type=dispositivo_circolaz
# https://www.comune.napoli.it/feed/?post_type=evento
# https://www.comune.napoli.it/tipi_evento/mostra/feed/?post_type=evento

for entry in valid_articles:
    print(entry.title)
    print(entry.link)
    print(entry.published)
    print(entry.summary)
    print('---')