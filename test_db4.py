from playwright.sync_api import sync_playwright

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto('http://localhost:3000')
        page.wait_for_load_state('networkidle')

        # Click through lobby
        page.locator('button', has_text='Create Room').click()
        page.wait_for_timeout(1000)

        # Trigger battle normally
        page.evaluate('document.getElementById("battle-container").style.display = "flex"; currentMap="route1"; startBattle();')
        page.wait_for_timeout(1000)

        page.screenshot(path='/home/jules/verification/battle_bg_advanced_stats_normal.png')

        browser.close()

if __name__ == '__main__':
    verify()
