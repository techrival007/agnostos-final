import getpass
import time
from . import constants as c
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

def __prompt_email_password():
  u = input("Email: ")
  p = getpass.getpass(prompt="Password: ")
  return (u, p)

def page_has_loaded(driver):
    page_state = driver.execute_script('return document.readyState;')
    return page_state == 'complete'

def login(driver, email=None, password=None, cookie=None, timeout=10):
    if cookie is not None:
        return _login_with_cookie(driver, cookie)

    if not email or not password:
        email, password = __prompt_email_password()

    import time as _time
    for attempt in range(3):
        driver.get("https://www.linkedin.com/login")
        try:
            element = WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.ID, "username")))
            break
        except Exception:
            if attempt < 2:
                _time.sleep(5)
            else:
                raise

    email_elem = driver.find_element(By.ID, "username")
    email_elem.send_keys(email)

    password_elem = driver.find_element(By.ID, "password")
    password_elem.send_keys(password)
    password_elem.submit()

    if driver.current_url == 'https://www.linkedin.com/checkpoint/lg/login-submit':
        try:
            remember = driver.find_element(By.ID, c.REMEMBER_PROMPT)
            if remember:
                remember.submit()
        except Exception:
            pass

    deadline = time.time() + timeout
    while time.time() < deadline:
        url = driver.current_url
        if "/feed" in url or "/mynetwork" in url or "/in/" in url:
            return
        try:
            driver.find_element(By.CLASS_NAME, c.VERIFY_LOGIN_ID)
            return
        except Exception:
            pass
        time.sleep(1)

def _login_with_cookie(driver, cookie):
    driver.get("https://www.linkedin.com/login")
    driver.add_cookie({
      "name": "li_at",
      "value": cookie
    })
    driver.get("https://www.linkedin.com/feed/")
