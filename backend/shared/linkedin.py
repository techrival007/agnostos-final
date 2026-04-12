import asyncio
import logging
import traceback
import time
from functools import partial

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _log(msg: str):
    print(f"[linkedin] {msg}", flush=True)


def _make_driver():
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options

    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_argument(
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    )
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    return webdriver.Chrome(options=chrome_options)


def _scroll_page(driver):
    scroll_height = driver.execute_script("return document.body.scrollHeight")
    step = max(scroll_height // 4, 500)
    for i in range(5):
        driver.execute_script(f"window.scrollTo(0, {step * i});")
        time.sleep(0.8)
    time.sleep(1)


def _click_all_see_more(driver):
    from selenium.webdriver.common.by import By
    buttons_clicked = 0
    try:
        buttons = driver.find_elements(By.TAG_NAME, "button")
        for btn in buttons:
            try:
                text = btn.text.strip().lower()
                if text in ("… more", "...more", "see more", "show all"):
                    driver.execute_script("arguments[0].click();", btn)
                    buttons_clicked += 1
                    time.sleep(0.5)
            except Exception:
                continue
    except Exception:
        pass

    try:
        spans = driver.find_elements(By.XPATH, "//button/span")
        for span in spans:
            try:
                text = span.text.strip().lower()
                if "show all" in text or "see more" in text:
                    driver.execute_script("arguments[0].click();", span.find_element(By.XPATH, ".."))
                    buttons_clicked += 1
                    time.sleep(0.5)
            except Exception:
                continue
    except Exception:
        pass

    return buttons_clicked


def _get_page_text(driver):
    from selenium.webdriver.common.by import By
    main_elems = driver.find_elements(By.TAG_NAME, "main")
    if main_elems:
        return main_elems[0].text
    return driver.find_element(By.TAG_NAME, "body").text


FOOTER_MARKERS = {
    "Accessibility", "Talent Solutions", "Community Guidelines",
    "Marketing Solutions", "Privacy & Terms", "LinkedIn Corporation",
    "Safety Center", "Select language", "Ad Choices",
}

NOISE_MARKERS = {"More profiles for you", "People you may know", "People also viewed", "You might like"}


def _clean_section_text(text: str) -> str:
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    cut = len(lines)
    for i, line in enumerate(lines):
        if any(fm in line for fm in FOOTER_MARKERS) or line in NOISE_MARKERS:
            cut = i
            break
    return "\n".join(lines[:cut])


def _get_detail_page_text(driver, base_url: str, detail_path: str) -> str:
    url = base_url.rstrip("/") + f"/details/{detail_path}/"
    _log(f"  navigating to {url}")
    try:
        driver.get(url)
        time.sleep(3)
        _scroll_page(driver)
        _click_all_see_more(driver)
        time.sleep(1)
        text = _get_page_text(driver)
        cleaned = _clean_section_text(text)
        line_count = len(cleaned.split("\n"))
        _log(f"  {detail_path}: {line_count} lines (cleaned)")
        return cleaned
    except Exception as e:
        _log(f"  {detail_path}: failed -- {e}")
        return ""


def _scrape_sync(url: str) -> dict | None:
    _log(f"--- SCRAPE START --- url={url}")

    import sys
    import os
    scraper_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "linkedin_scraper"))
    if scraper_path not in sys.path:
        sys.path.insert(0, scraper_path)

    try:
        from selenium.webdriver.common.by import By
        from linkedin_scraper import actions
    except ImportError as e:
        _log(f"FATAL: import failed: {e}")
        return None

    email = settings.linkedin_email
    password = settings.linkedin_password
    if not email or not password:
        _log("ABORT: LINKEDIN_EMAIL / LINKEDIN_PASSWORD not set")
        return None

    _log("launching Chrome...")
    try:
        driver = _make_driver()
    except Exception as e:
        _log(f"FATAL: Chrome failed to launch: {e}")
        return None

    try:
        # --- LOGIN ---
        _log("step 1/5: logging in...")
        actions.login(driver, email, password, timeout=30)
        _log(f"login done: {driver.current_url}")

        if "challenge" in driver.current_url or "checkpoint" in driver.current_url:
            _log("ABORT: challenge/captcha detected")
            return None
        if "login" in driver.current_url:
            _log("ABORT: still on login page -- bad credentials?")
            return None

        # --- MAIN PROFILE PAGE ---
        _log(f"step 2/5: loading profile {url}")
        driver.get(url)
        time.sleep(5)
        profile_url = driver.current_url.rstrip("/")
        _log(f"profile url resolved to: {profile_url}")

        _scroll_page(driver)
        clicked = _click_all_see_more(driver)
        _log(f"clicked {clicked} 'see more' buttons on main page")
        time.sleep(1)

        _scroll_page(driver)
        main_text = _get_page_text(driver)
        main_lines = [l.strip() for l in main_text.split("\n") if l.strip()]
        _log(f"main page: {len(main_lines)} lines")

        # --- PARSE MAIN PAGE (name, headline, location, about) ---
        name, headline, location, about = _parse_header(main_lines)
        _log(f"parsed header: name={name}, headline={headline}, location={location}")

        # --- DETAIL PAGES ---
        _log("step 3/5: scraping detail pages...")
        detail_sections = {}
        for section_name, path in [
            ("experience", "experience"),
            ("education", "education"),
            ("skills", "skills"),
            ("certifications", "certifications"),
            ("projects", "projects"),
            ("courses", "courses"),
            ("honors", "honors"),
        ]:
            text = _get_detail_page_text(driver, profile_url, path)
            if text and len(text.strip()) > 50 and "Nothing to see for now" not in text:
                detail_sections[section_name] = text

        _log(f"step 4/5: detail sections found: {list(detail_sections.keys())}")

        # --- BUILD RESULT ---
        _log("step 5/5: building result...")
        combined_text = f"=== PROFILE ===\n{name or ''}\n{headline or ''}\n{location or ''}\n"
        if about:
            combined_text += f"\n=== ABOUT ===\n{about}\n"
        for section_name, text in detail_sections.items():
            combined_text += f"\n=== {section_name.upper()} ===\n{text}\n"

        combined_text = combined_text[:10000]

        result = {
            "name": name,
            "headline": headline,
            "location": location,
            "about": about,
            "profile_url": profile_url,
            "sections_found": list(detail_sections.keys()),
            "experience_raw": detail_sections.get("experience", ""),
            "education_raw": detail_sections.get("education", ""),
            "skills_raw": detail_sections.get("skills", ""),
            "certifications_raw": detail_sections.get("certifications", ""),
            "projects_raw": detail_sections.get("projects", ""),
            "courses_raw": detail_sections.get("courses", ""),
            "honors_raw": detail_sections.get("honors", ""),
            "full_profile_text": combined_text,
        }

        _log(f"--- SCRAPE SUCCESS --- name={name}, sections={list(detail_sections.keys())}")
        return result

    except Exception as e:
        _log(f"SCRAPE FAILED: {e}")
        _log(traceback.format_exc())
        return None
    finally:
        try:
            driver.quit()
            _log("Chrome quit OK")
        except Exception:
            pass
        _log("--- SCRAPE END ---")


def _parse_header(lines: list[str]) -> tuple[str | None, str | None, str | None, str | None]:
    SECTION_HEADERS = {
        "About", "Featured", "Activity", "Experience", "Education",
        "Licenses & Certifications", "Skills", "Projects",
        "Courses", "Honors & Awards", "Recommendations",
        "Languages", "Interests", "Organizations", "Volunteering",
    }
    STOP_WORDS = {"Follow", "Connect", "More", "Message", "Pending"}
    FOOTER_MARKERS = {
        "Accessibility", "Talent Solutions", "Community Guidelines",
        "Marketing Solutions", "Privacy & Terms", "LinkedIn Corporation",
    }

    footer_start = len(lines)
    for i, line in enumerate(lines):
        if any(fm in line for fm in FOOTER_MARKERS):
            footer_start = i
            break
    lines = lines[:footer_start]

    name = None
    headline = None
    location = None
    about = None

    header_start = 0
    for i, line in enumerate(lines):
        if line in SECTION_HEADERS or line in STOP_WORDS:
            continue
        if line.startswith("·") or line in ("Contact info", "He/Him", "She/Her", "They/Them"):
            continue
        if len(line) > 2 and not any(c.isdigit() for c in line[:3]):
            name = line
            header_start = i
            break

    if name:
        for line in lines[header_start + 1:]:
            if line in SECTION_HEADERS or line in STOP_WORDS:
                break
            if line.startswith("·") or line in ("Contact info", "He/Him", "She/Her", "They/Them"):
                continue
            if any(c.isdigit() for c in line) and "connection" in line.lower():
                continue
            if any(c.isdigit() for c in line) and "follower" in line.lower():
                continue
            if not headline and len(line) > 8:
                headline = line
            elif headline and not location and len(line) < 80:
                if any(g in line for g in ["Area", "City", "State", "County", "India", ","]):
                    location = line

    about_started = False
    about_lines = []
    for line in lines:
        if line == "About":
            about_started = True
            continue
        if about_started:
            if line in SECTION_HEADERS or line == "Top skills" or line in ("More profiles for you", "People you may know"):
                break
            if line in STOP_WORDS:
                break
            if line in ("… more", "...more", "See more"):
                continue
            about_lines.append(line)

    if about_lines:
        about = "\n".join(about_lines).strip()

    return name, headline, location, about


async def scrape_linkedin_profile(url: str) -> dict | None:
    _log(f"async wrapper called with url={url}")
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, partial(_scrape_sync, url))
    _log(f"async wrapper done: {'data' if result else 'None'}")
    return result


def format_linkedin_for_analysis(data: dict) -> str:
    if not data:
        return ""

    if "full_profile_text" in data:
        parts = []
        if data.get("name"):
            parts.append(f"Name: {data['name']}")
        if data.get("headline"):
            parts.append(f"Headline: {data['headline']}")
        if data.get("location"):
            parts.append(f"Location: {data['location']}")
        if data.get("about"):
            parts.append(f"\nAbout:\n{data['about']}")
        if data.get("profile_url"):
            parts.append(f"\nProfile URL: {data['profile_url']}")
        parts.append(f"\n--- Full Profile Text ---\n{data['full_profile_text']}")
        return "\n".join(parts)

    parts = []
    if data.get("name"):
        parts.append(f"Name: {data['name']}")
    if data.get("headline"):
        parts.append(f"Headline: {data['headline']}")
    if data.get("location"):
        parts.append(f"Location: {data['location']}")
    if data.get("about"):
        parts.append(f"About: {data['about']}")
    return "\n".join(parts)
