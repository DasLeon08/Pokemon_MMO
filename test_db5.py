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

        # Trigger battle
        page.evaluate('document.getElementById("battle-container").style.display = "flex"; currentMap="route1"; wildPokemon = generatePokemon(644, 70, false); activePokemon = generatePokemon(495, 70, false); updateBattleUI(); startBattle();')
        page.wait_for_timeout(1000)

        page.screenshot(path='/home/jules/verification/battle_bg_advanced_stats_gen5.png')

        browser.close()

if __name__ == '__main__':
    verify()
