from playwright.sync_api import sync_playwright
import time

def verify_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto('http://localhost:3000')

        # Click create room to enter game
        page.click('#createRoomBtn')
        time.sleep(2) # wait for map/players to load and draw

        # Take screenshot of main UI
        page.screenshot(path='/home/jules/verification/game_shadows_ui.png')

        # Open shop (mock by evaluating javascript)
        page.evaluate('''
            inShop = true;
            document.getElementById('shop-container').style.display = 'block';
        ''')
        time.sleep(1) # wait for render

        # Take screenshot of shop UI
        page.screenshot(path='/home/jules/verification/shop_ui.png')

        print("Screenshots saved.")
        browser.close()

if __name__ == '__main__':
    verify_ui()