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

        # Give the player a level 50 pokemon and trigger a battle to see if the wild one scales correctly
        page.evaluate('document.getElementById("battle-container").style.display = "flex"; currentMap="route1"; myTeam = [generatePokemon(495, 50, false)]; activePokemon = myTeam[0]; wildPokemon = null; startBattle();')
        page.wait_for_timeout(1000)

        page.screenshot(path='/home/jules/verification/battle_bg_scaled.png')

        browser.close()

if __name__ == '__main__':
    verify()
