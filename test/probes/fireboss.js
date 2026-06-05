// drive the fire dimension and confirm the boss death drops loot + opens the End portal
loadDimension('fire');
console.log('fire boss spawned hp', fireBoss && fireBoss.hp);
if (fireBoss) { fireBoss.hp = -1; updateFireBoss(0.05); }
console.log('after kill: bossGone', !fireBoss, '| endPortalOpened', fireBossDown, '| gotCharm', countItem(I_FIRECHARM) > 0, '| fireCrystals', countItem(FIRE_CRYSTAL));
