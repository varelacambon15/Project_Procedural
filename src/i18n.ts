// Textos del juego. Inglés por defecto; español como segunda lengua. Se elige en el menú principal.
export type Lang = "en" | "es";
type Dict = Record<string, string>;

const en: Dict = {
  "dummy.sturdy": "Sturdy dummy",
  "fx.explosive": "Explosive Rounds", "fx.explosive.d": "Bullets burst on impact, damaging nearby enemies. Less direct damage.",
  "fx.fuego": "Incendiary Rounds", "fx.fuego.d": "Hits set the target on fire for a few seconds (refreshes, does not stack). Bright tracers give you away.",
  "fx.electrico": "Shock Rounds", "fx.electrico.d": "Hits arc to 1-2 nearby enemies and briefly stun. Less direct damage, short arc.",
  "fx.tally": "Tally", "fx.tally.d": "Each kill: +2.5% damage (max +10%) for a few seconds. Lost on reload or swap.", "fx.instigator": "First Blood", "fx.instigator.d": "+20% damage against targets at full health.", "fx.breath": "Steady Breath", "fx.breath.d": "Aim for 1.5 s without firing: next shot +15% damage.", "fx.lastbullets": "Last Rounds", "fx.lastbullets.d": "The last 20% of the magazine deals +15% damage.", "fx.rapid": "Quick Rhythm", "fx.rapid.d": "+8% fire rate and 10% faster reload.", "fx.relay": "Relay", "fx.relay.d": "Damage with your other weapon, then swap: +15% damage for 4 s.", "fx.surrounded": "Surrounded", "fx.surrounded.d": "With 3+ enemies within 8 m: +12% damage.", "fx.refund": "Salvage", "fx.refund.d": "Missed shots have a 15% chance to return the round.", "fx.kickstart": "Kickstart", "fx.kickstart.d": "After sprinting for 1 s: +15% damage for 2 s.", "fx.spreadfire": "Wildfire", "fx.spreadfire.d": "Fire. Kills ignite nearby enemies.", "fx.voltshot": "Voltshot", "fx.voltshot.d": "Electric. Reload after a kill: the next hit chains lightning to 3 enemies.", "fx.unstable": "Unstable", "fx.unstable.d": "Explosive. Kills destabilize nearby enemies: they explode when they die.", "fx.timedpayload": "Slow Fuse", "fx.timedpayload.d": "Explosive. Rounds stick and detonate after a moment.", "fx.giantslayer": "Giant Slayer", "fx.giantslayer.d": "+25% damage against large targets.", "fx.tremors": "Tremors", "fx.tremors.d": "3 quick hits on the same target release a shockwave.", "fx.choke": "Tight Choke", "fx.choke.d": "Aiming tightens the spread by half and adds +10% damage.", "fx.alternator": "Two Minds", "fx.alternator.d": "Alternates fire and electric with every magazine.", "fx.spinup": "Overdrive", "fx.spinup.d": "Fire rate climbs while you hold the trigger (up to +80%).", "fx.steady": "Steady Hands", "fx.steady.d": "-{v}% recoil.",
  "fx.quickdraw": "Quickdraw", "fx.quickdraw.d": "Ready and aim this weapon faster.",
  "fx.headhunter": "Headhunter", "fx.headhunter.d": "+{v}% precision (headshot) damage.",
  "fx.extmag": "Extended Mag", "fx.extmag.d": "+{v}% magazine size.",
  "fx.range": "Rangefinder", "fx.range.d": "+{v}% effective range.",
  "fx.opening": "Opening Shot", "fx.opening.d": "The first shot from a full magazine deals +{v}% damage.",
  "fx.killreload": "Practiced Reload", "fx.killreload.d": "Reloading shortly after a kill is {v}% faster.",
  "fx.scavenger": "Scavenger", "fx.scavenger.d": "Kills put 1 round back in the magazine.",
  "fx.adsfocus": "Focused Aim", "fx.adsfocus.d": "-{v}% spread while aiming down sights.",
  "fx.pierce": "Light Penetration", "fx.pierce.d": "Bullets pass through one target at half damage.",
  "fx.doble": "Twin Barrel", "fx.doble.d": "Fires 2 projectiles per shot. More recoil.",
  "fx.rebote": "Ricochet", "fx.rebote.d": "Bullets bounce to the nearest enemy for half damage.",
  "fx.eco": "Echo", "fx.eco.d": "Every 5th shot is repeated for free half a second later.",
  "fx.piercing": "Penetrator", "fx.piercing.d": "Bullets pass through up to 2 more targets.",
  "fx.killclip": "Kill Clip", "fx.killclip.d": "Reloading after a kill grants +35% damage for 4 seconds.",
  "fx.rampage": "Rampage", "fx.rampage.d": "Each kill grants +10% damage for 4 seconds, stacking 3 times.",
  "fx.frenzy": "Frenzy", "fx.frenzy.d": "Kills grant +50% fire rate for 5 seconds.",
  "fx.lastrounds": "Last Will", "fx.lastrounds.d": "The last quarter of the magazine deals double damage.",
  "fx.widowmark": "Widow's Kiss", "fx.widowmark.d": "Every hit marks the target. The 5th mark detonates for 150% damage.",
  "fx.olddog": "Old Dog's Bite", "fx.olddog.d": "Kills refill the whole magazine.",
  "fx.requiem": "Requiem", "fx.requiem.d": "Every 6th shot bursts into 6 shards that seek nearby enemies.",
  "fx.deadhand": "Dead Man's Draw", "fx.deadhand.d": "After a kill, your next shot is a guaranteed critical for triple damage.",
  "fx.stormcaller": "Storm Call", "fx.stormcaller.d": "Kills call down lightning that strikes every enemy within 8 m.",
  "fx.verdict": "Final Verdict", "fx.verdict.d": "Precision hits explode.",
  "fx.echochamber": "Echo Chamber", "fx.echochamber.d": "Every 4th shot echoes twice.",
  // Rarezas y tipos
  "ui.lootDrop": "{r} drop: {n}",
  "rarity.comun": "Common", "rarity.poco": "Uncommon", "rarity.rara": "Rare", "rarity.epica": "Epic", "rarity.legendaria": "Legendary",
  "type.pistol": "Pistol", "type.revolver": "Revolver", "type.smg": "SMG", "type.rifle": "Rifle", "type.bullpup": "Bullpup",
  "type.shotgun": "Shotgun", "type.sniper": "Sniper Rifle", "type.launcher": "Launcher", "type.flamethrower": "Flamethrower", "type.lmg": "Machine Gun",
  // Variantes (arquetipos)
  "rc.stat.dmg": "damage", "rc.stat.rate": "fire rate", "rc.stat.crit": "crit damage", "rc.stat.spread": "spread", "rc.stat.recoil": "recoil", "rc.stat.reload": "reload time", "rc.stat.mag": "magazine size", "rc.stat.range": "range",
  "rc.Stat.dmg": "Damage", "rc.Stat.rate": "Fire rate", "rc.Stat.crit": "Crits", "rc.Stat.spread": "Tight spread", "rc.Stat.recoil": "Steady", "rc.Stat.reload": "Fast reload", "rc.Stat.mag": "Big magazine", "rc.Stat.range": "Long reach",
  "rc.up": "+{v}% {s}", "rc.down": "−{v}% {s}", "rc.buff": "{b} for {d}s",
  "rc.cond.always": "", "rc.cond.aiming": "while aiming", "rc.cond.hip": "from the hip", "rc.cond.still": "standing still", "rc.cond.moving": "on the move", "rc.cond.near": "with 3+ enemies close", "rc.cond.lowammo": "on a low magazine",
  "rc.cond.afterkill": "after a kill", "rc.cond.afterreload": "after reloading", "rc.cond.big": "vs. big targets", "rc.cond.nth": "every {n}th shot", "rc.cond.chance": "{c}% of hits",
  "rc.name": "{S} {c}", "rc.risky": "{n} · all-in",
  "rc.trig.onHit": "On hit", "rc.trig.onCrit": "On crit", "rc.trig.onKill": "On kill", "rc.trig.onReloadEnd": "On reload", "rc.trig.onShot": "", "rc.trig.passive": "",
  "rc.act.explode": "blast ({p}% of damage)", "rc.act.chain": "arc jumps to {n} enemies ({p}%)", "rc.act.ignite": "sets nearby enemies on fire ({r} m)", "rc.act.shards": "{n} shards ({p}%)",
  "rc.act.strike": "lightning from above ({r} m)", "rc.act.pull": "drags enemies in ({r} m) and bursts", "rc.act.pellets": "×{v} projectiles per shot", "rc.act.fury": "rage {v}s: no ammo used, full auto",
  "rc.el.fuego": "Fire", "rc.el.electrico": "Electric", "rc.el.explosive": "Explosive",
  "rc.tr.accuracy": "−{v} accuracy", "rc.tr.recoil": "+{v}% recoil", "rc.tr.rate": "−{v}% fire rate", "rc.tr.mag": "−{v}% magazine (min. 1)", "rc.tr.ads": "−{v}% aim speed", "rc.tr.reload": "+{v}% reload time",
  "rc.tr.range": "−{v}% range", "rc.tr.ammoPerShot": "uses {v} rounds per shot", "rc.tr.selfDamage": "light self-damage up close", "rc.tr.heat": "overheats", "rc.tr.cooldown": "long cooldown",
  "rc.tr.element": "element penalty: less direct damage",
  "cal.light": "Light .38", "cal.medium": "Medium .357", "cal.heavy": "Heavy .454", "cal.magnum": "Magnum .500",
  "hold.one": "One-handed", "hold.two": "Two-handed", "hold.switch": "Two hands when aiming", "hold.vgrip": "Foregrip", "hold.stock": "Shouldered",
  "hold.front": "Handguard", "hold.mag": "Magazine grip", "hold.pump": "Pump",
  "arch.standard": "Standard", "arch.machine": "Machine pistol", "arch.heavy": "Heavy", "arch.quick": "Quick-draw", "arch.rapid": "Rapid-fire",
  "arch.tactical": "Tactical", "arch.auto": "Automatic", "arch.burst": "Burst", "arch.marksman": "Marksman", "arch.pump": "Pump-action",
  "arch.semi": "Semi-auto", "arch.double": "Double-barrel", "arch.bolt": "Bolt-action", "arch.antimateriel": "Anti-materiel", "arch.minigun": "Rotary",
  "mode.auto": "Auto", "mode.semi": "Semi", "mode.burst": "Burst", "mode.pump": "Pump", "mode.bolt": "Bolt",
  "shift.auto": "Full-auto conversion", "shift.burst": "Burst conversion", "shift.semi": "Semi-auto conversion",
  // Estadísticas
  "stat.dano": "Damage", "stat.cadencia": "Fire rate", "stat.precision": "Accuracy", "stat.alcance": "Range", "stat.manejo": "Handling", "stat.cargador": "Magazine",
  "unit.rpm": "/min", "unit.m": "m", "label.damage": "damage", "label.level": "Lv",
  // Habilidades
  // Acabados y piezas
  "paint.original": "Factory", "paint.fdeblack": "Black / FDE furniture", "paint.olivefde": "Olive / FDE furniture", "paint.grayblack": "Gray / black furniture", "paint.black": "Matte black", "paint.sand": "Desert sand", "paint.woodbrass": "Wood & brass", "paint.gunmetal": "Gunmetal", "paint.twotone": "Black with sand furniture", "paint.parkerized": "Parkerized & walnut", "paint.fde": "Flat dark earth", "paint.olive": "Olive drab", "paint.gray": "Storm gray", "paint.rust": "Rusted",
  "slot.stock": "Stock", "slot.grip": "Grip", "slot.front": "Handguard", "slot.trigger": "Trigger", "slot.charging": "Charging handle", "slot.pump": "Pump", "slot.device": "Under-rail", "role.receiver": "Receiver", "role.stock": "Stock", "role.grip": "Grip", "role.front": "Handguard",
  "slot.magazine": "Magazine", "slot.scope": "Optic", "slot.muzzle": "Muzzle", "slot.slide": "Slide", "slot.frame": "Frame", "slot.barrel": "Barrel",
  "role.body": "Body", "role.frame": "Frame", "role.slide": "Slide", "role.barrel": "Barrel", "role.magazine": "Magazine", "role.scope": "Optic", "role.muzzle": "Muzzle",
  "acc.suppressor-s": "Short suppressor", "acc.suppressor-l": "Long suppressor", "acc.compensator": "Compensator", "acc.brake": "Muzzle brake", "acc.flashhider": "Flash hider",
  "acc.reddot": "Red dot", "acc.holo": "Holographic", "acc.acog": "4x combat scope", "acc.scope6": "6x scope",
  // Muñecos
  "dummy.small": "Small target", "dummy.large": "Large target", "dummy.basic": "Dummy", "dummy.armored": "Armored dummy", "dummy.shielded": "Shielded dummy", "dummy.elite": "Test elite", "dummy.boss": "Test colossus",
  // Interfaz del juego
  "ui.play": "Enter the range", "ui.resume": "Back to the range", "ui.pause": "Paused", "ui.title": "Proving Grounds",
  "ui.eyebrow": "Playable demo · Phase 1", "ui.language": "Language",
  "ui.intro": "A firing range to test the procedural weapons. Open the crate for new guns, customize them at the workbench and try them on dummies with shields, armor and health. Dummies get back up after they fall.",
  "ui.kbm": "Keyboard & mouse", "ui.pad": "Controller",
  "c.move": "move", "c.look": "aim", "c.fire": "fire / aim down sights", "c.reload": "reload", "c.swap": "switch weapon", "c.sprint": "sprint · jump", "c.use": "pick up / crate / workbench", "c.inv": "inventory", "c.pause": "pause", "c.inspect": "inspect weapon",
  "c.sticks": "move · aim (with aim assist)", "c.menus": "In menus", "c.menus.d": "left stick moves the cursor, Ⓐ click, Ⓑ back, RB drop",
  "ui.inventory": "Inventory", "ui.equipped": "Equipped", "ui.backpack": "Backpack", "ui.slot": "Slot {n}", "ui.empty": "Empty", "ui.dropHere": "Place a weapon here",
  "ui.invKeys": "Drag or click to move · Right-click equip / store · G drop · X scrap (backpack) · Tab close",
  "ui.inHand": "IN HAND", "ui.compared": "Compared to your current weapon", "ui.preview": "Preview of the change",
  "ui.packCount": "Backpack", "ui.looseParts": "Loose parts", "ui.scrap": "Scrap",
  "ui.workbench": "Workbench", "ui.benchKeys": "Pick a weapon · hover a part to preview the change · E close", "ui.yourWeapons": "Your weapons", "ui.parts": "Parts",
  "ui.drag": "Drag to rotate", "ui.noWeapons": "No weapons. Open the crate.", "ui.remove": "Remove", "ui.noParts": "No compatible parts in the box",
  "ui.finish": "Finish", "ui.partsBox": "Parts box", "ui.partsBoxInfo": "{n} parts · {s} scrap", "ui.partsEmpty": "Empty. Scrap weapons to get parts.", "ui.scrapWeapon": "Scrap this weapon",
  "ui.scrapped": "Scrapped: +{p} parts, +{s} scrap", "ui.packFull": "Backpack full: scrap a weapon first",
  "ui.openCrate": "Open crate", "ui.useBench": "Use workbench", "ui.equippedTo": "Equipped", "ui.storedIn": "Stored in your backpack", "ui.tabToSee": "Tab to open the inventory",
  "ui.reloading": "reloading…", "ui.pixelLevel": "Texture pixel level: {n} px", "ui.waveDone": "Wave {n} cleared", "ui.wavesDone": "All waves cleared", "ui.simReset": "Simulation reset", "ui.waveN": "Wave {n}/{of} · {left} left", "ui.wavesStart": "Start test waves", "ui.wavesStop": "Stop waves", "ui.wavesGo": "Waves incoming", "ui.inspect": "Inspection bench", "ui.dmgOn": "Damage numbers on", "ui.night": "Night range (neon)", "ui.day": "Day range", "ui.dmgOff": "Damage numbers off", "ui.equippedNow": "Equipped", "sim.data": "SIM DATA", "sim.ttk": "TTK", "sim.acc": "ACC", "sim.dist": "DIST", "sim.active": "SIMULATION ACTIVE", "sim.calibrating": "CALIBRATING", "ui.pickup": "Pick up", "ui.dropZone": "Drag a weapon here to drop it on the ground", "ui.dropped": "Dropped {n}", "ui.noWeapon": "No weapon", "ui.fists": "Fists", "ui.bossDown": "Colossus down!",
  "hint.kbm": "<kbd>Click</kbd>fire <kbd>RMB</kbd>aim <kbd>R</kbd>reload <kbd>1</kbd><kbd>2</kbd>weapons <kbd>F</kbd>inspect <kbd>E</kbd>use <kbd>Tab</kbd>inventory",
  "hint.pad": "<kbd>RT</kbd>fire <kbd>LT</kbd>aim <kbd>Ⓧ</kbd>reload <kbd>Ⓨ</kbd>switch <kbd>Ⓑ</kbd>use <kbd>View</kbd>inventory",
  "ui.loadError": "The game could not load: {e}",
};

const es: Dict = {
  "dummy.sturdy": "Maniquí resistente",
  "fx.explosive": "Munición explosiva", "fx.explosive.d": "Las balas estallan al impactar y dañan a los enemigos cercanos. Menos daño directo.",
  "fx.fuego": "Munición incendiaria", "fx.fuego.d": "Los impactos queman al objetivo unos segundos (se renueva, no se apila). Las trazadoras te delatan.",
  "fx.electrico": "Munición eléctrica", "fx.electrico.d": "Los impactos saltan a 1-2 enemigos cercanos y aturden un instante. Menos daño directo y arco corto.",
  "fx.tally": "Racha", "fx.tally.d": "Cada baja: +2,5 % de daño (máx. +10 %) unos segundos. Se pierde al recargar o cambiar.", "fx.instigator": "Primer golpe", "fx.instigator.d": "+20 % de daño contra objetivos con la vida completa.", "fx.breath": "Pulso firme", "fx.breath.d": "Apunta 1,5 s sin disparar: el siguiente disparo hace +15 % de daño.", "fx.lastbullets": "Últimas balas", "fx.lastbullets.d": "El último 20 % del cargador hace +15 % de daño.", "fx.rapid": "Ritmo ágil", "fx.rapid.d": "+8 % de cadencia y recarga un 10 % más rápida.", "fx.relay": "Relevo", "fx.relay.d": "Haz daño con tu otra arma y cambia: +15 % de daño durante 4 s.", "fx.surrounded": "Rodeado", "fx.surrounded.d": "Con 3 o más enemigos a menos de 8 m: +12 % de daño.", "fx.refund": "Munición recuperada", "fx.refund.d": "Los disparos fallados tienen un 15 % de devolver la bala.", "fx.kickstart": "Arranque", "fx.kickstart.d": "Tras esprintar 1 s: +15 % de daño durante 2 s.", "fx.spreadfire": "Incendio", "fx.spreadfire.d": "Fuego. Las bajas prenden a los enemigos cercanos.", "fx.voltshot": "Descarga", "fx.voltshot.d": "Eléctrico. Recarga tras una baja: el siguiente impacto encadena un rayo a 3 enemigos.", "fx.unstable": "Inestable", "fx.unstable.d": "Explosivo. Las bajas desestabilizan a los cercanos: explotan al morir.", "fx.timedpayload": "Mecha lenta", "fx.timedpayload.d": "Explosivo. Las balas se pegan y detonan tras un instante.", "fx.giantslayer": "Cazagigantes", "fx.giantslayer.d": "+25 % de daño contra objetivos grandes.", "fx.tremors": "Temblores", "fx.tremors.d": "3 impactos rápidos al mismo objetivo lanzan una onda de choque.", "fx.choke": "Choke cerrado", "fx.choke.d": "Al apuntar, la dispersión se reduce a la mitad y hace +10 % de daño.", "fx.alternator": "Dos mentes", "fx.alternator.d": "Alterna fuego y eléctrico con cada cargador.", "fx.spinup": "Sobrevelocidad", "fx.spinup.d": "La cadencia sube mientras mantienes el gatillo (hasta +80 %).", "fx.steady": "Pulso firme", "fx.steady.d": "-{v}% de retroceso.",
  "fx.quickdraw": "Desenfundado rápido", "fx.quickdraw.d": "Sacas y apuntas esta arma más rápido.",
  "fx.headhunter": "Cazacabezas", "fx.headhunter.d": "+{v}% de daño de precisión (a la cabeza).",
  "fx.extmag": "Cargador ampliado", "fx.extmag.d": "+{v}% de capacidad del cargador.",
  "fx.range": "Telémetro", "fx.range.d": "+{v}% de alcance efectivo.",
  "fx.opening": "Primer disparo", "fx.opening.d": "El primer disparo de un cargador lleno hace +{v}% de daño.",
  "fx.killreload": "Recarga entrenada", "fx.killreload.d": "Recargar poco después de una baja es un {v}% más rápido.",
  "fx.scavenger": "Carroñero", "fx.scavenger.d": "Cada baja devuelve 1 bala al cargador.",
  "fx.adsfocus": "Puntería concentrada", "fx.adsfocus.d": "-{v}% de dispersión al apuntar con la mira.",
  "fx.pierce": "Penetración ligera", "fx.pierce.d": "Las balas atraviesan un objetivo con la mitad de daño.",
  "fx.doble": "Doble cañón", "fx.doble.d": "Dispara 2 proyectiles por disparo. Más retroceso.",
  "fx.rebote": "Rebote", "fx.rebote.d": "Las balas rebotan al enemigo más cercano con la mitad de daño.",
  "fx.eco": "Eco", "fx.eco.d": "Cada 5.º disparo se repite gratis medio segundo después.",
  "fx.piercing": "Perforador", "fx.piercing.d": "Las balas atraviesan hasta 2 objetivos más.",
  "fx.killclip": "Cargador letal", "fx.killclip.d": "Recargar tras una baja da +35% de daño durante 4 segundos.",
  "fx.rampage": "Furia", "fx.rampage.d": "Cada baja da +10% de daño durante 4 segundos (hasta 3 veces).",
  "fx.frenzy": "Frenesí", "fx.frenzy.d": "Cada baja da +50% de cadencia durante 5 segundos.",
  "fx.lastrounds": "Última voluntad", "fx.lastrounds.d": "El último cuarto del cargador hace el doble de daño.",
  "fx.widowmark": "Beso de la viuda", "fx.widowmark.d": "Cada impacto marca al objetivo. La 5.ª marca detona con un 150% de daño.",
  "fx.olddog": "Mordisco del perro viejo", "fx.olddog.d": "Cada baja rellena el cargador entero.",
  "fx.requiem": "Réquiem", "fx.requiem.d": "Cada 6.º disparo estalla en 6 esquirlas que buscan enemigos cercanos.",
  "fx.deadhand": "Mano del muerto", "fx.deadhand.d": "Tras una baja, el siguiente disparo es un crítico garantizado con triple daño.",
  "fx.stormcaller": "Llamada de la tormenta", "fx.stormcaller.d": "Cada baja invoca un rayo que golpea a todos los enemigos a menos de 8 m.",
  "fx.verdict": "Veredicto final", "fx.verdict.d": "Los impactos de precisión explotan.",
  "fx.echochamber": "Cámara de eco", "fx.echochamber.d": "Cada 4.º disparo se repite dos veces.",
  "ui.lootDrop": "Botín {r}: {n}",
  "rarity.comun": "Común", "rarity.poco": "Poco común", "rarity.rara": "Rara", "rarity.epica": "Épica", "rarity.legendaria": "Legendaria",
  "type.pistol": "Pistola", "type.revolver": "Revólver", "type.smg": "Subfusil", "type.rifle": "Fusil", "type.bullpup": "Bullpup",
  "type.shotgun": "Escopeta", "type.sniper": "Francotirador", "type.launcher": "Lanzacohetes", "type.flamethrower": "Lanzallamas", "type.lmg": "Ametralladora",
  "rc.stat.dmg": "daño", "rc.stat.rate": "cadencia", "rc.stat.crit": "daño crítico", "rc.stat.spread": "dispersión", "rc.stat.recoil": "retroceso", "rc.stat.reload": "tiempo de recarga", "rc.stat.mag": "capacidad del cargador", "rc.stat.range": "alcance",
  "rc.Stat.dmg": "Daño", "rc.Stat.rate": "Cadencia", "rc.Stat.crit": "Críticos", "rc.Stat.spread": "Agrupación", "rc.Stat.recoil": "Firmeza", "rc.Stat.reload": "Recarga ágil", "rc.Stat.mag": "Cargador grande", "rc.Stat.range": "Largo alcance",
  "rc.up": "+{v} % de {s}", "rc.down": "−{v} % de {s}", "rc.buff": "{b} durante {d} s",
  "rc.cond.always": "", "rc.cond.aiming": "al apuntar", "rc.cond.hip": "desde la cadera", "rc.cond.still": "estando quieto", "rc.cond.moving": "en movimiento", "rc.cond.near": "con 3+ enemigos cerca", "rc.cond.lowammo": "con poco cargador",
  "rc.cond.afterkill": "tras una baja", "rc.cond.afterreload": "tras recargar", "rc.cond.big": "contra objetivos grandes", "rc.cond.nth": "cada {n}.º disparo", "rc.cond.chance": "el {c} % de los impactos",
  "rc.name": "{S} {c}", "rc.risky": "{n} · a tope",
  "rc.trig.onHit": "Al impactar", "rc.trig.onCrit": "Al acertar un crítico", "rc.trig.onKill": "Al abatir", "rc.trig.onReloadEnd": "Al recargar", "rc.trig.onShot": "", "rc.trig.passive": "",
  "rc.act.explode": "explosión ({p} % del daño)", "rc.act.chain": "rayo que salta a {n} enemigos ({p} %)", "rc.act.ignite": "prende a los enemigos cercanos ({r} m)", "rc.act.shards": "{n} esquirlas ({p} %)",
  "rc.act.strike": "rayo del cielo ({r} m)", "rc.act.pull": "atrae a los enemigos ({r} m) y estalla", "rc.act.pellets": "×{v} proyectiles por disparo", "rc.act.fury": "furia {v} s: no gasta munición, automática",
  "rc.el.fuego": "Fuego", "rc.el.electrico": "Eléctrico", "rc.el.explosive": "Explosivo",
  "rc.tr.accuracy": "−{v} de precisión", "rc.tr.recoil": "+{v} % de retroceso", "rc.tr.rate": "−{v} % de cadencia", "rc.tr.mag": "−{v} % de cargador (mín. 1)", "rc.tr.ads": "−{v} % de velocidad al apuntar", "rc.tr.reload": "+{v} % de tiempo de recarga",
  "rc.tr.range": "−{v} % de alcance", "rc.tr.ammoPerShot": "gasta {v} balas por disparo", "rc.tr.selfDamage": "autodaño leve si estalla cerca", "rc.tr.heat": "se sobrecalienta", "rc.tr.cooldown": "enfriamiento largo",
  "rc.tr.element": "penalización del elemento: menos daño directo",
  "cal.light": "Ligero .38", "cal.medium": "Medio .357", "cal.heavy": "Pesado .454", "cal.magnum": "Mágnum .500",
  "hold.one": "A una mano", "hold.two": "A dos manos", "hold.switch": "Dos manos al apuntar", "hold.vgrip": "Empuñadura delantera", "hold.stock": "Al hombro",
  "hold.front": "Guardamanos", "hold.mag": "Por el cargador", "hold.pump": "Bombeo",
  "arch.standard": "Estándar", "arch.machine": "Automática", "arch.heavy": "Pesada", "arch.quick": "Rápida", "arch.rapid": "Cadencia alta",
  "arch.tactical": "Táctica", "arch.auto": "Automático", "arch.burst": "Ráfagas", "arch.marksman": "Tirador", "arch.pump": "De corredera",
  "arch.semi": "Semiautomática", "arch.double": "De dos cañones", "arch.bolt": "De cerrojo", "arch.antimateriel": "Antimaterial", "arch.minigun": "Rotativa",
  "mode.auto": "Auto", "mode.semi": "Semi", "mode.burst": "Ráfaga", "mode.pump": "Corredera", "mode.bolt": "Cerrojo",
  "shift.auto": "Conversión automática", "shift.burst": "Conversión a ráfagas", "shift.semi": "Conversión semiautomática",
  "stat.dano": "Daño", "stat.cadencia": "Cadencia", "stat.precision": "Precisión", "stat.alcance": "Alcance", "stat.manejo": "Manejo", "stat.cargador": "Cargador",
  "unit.rpm": "/min", "unit.m": "m", "label.damage": "daño", "label.level": "Nv",
  "paint.original": "De fábrica", "paint.fdeblack": "Negro con muebles FDE", "paint.olivefde": "Oliva con muebles FDE", "paint.grayblack": "Gris con muebles negros", "paint.black": "Negro mate", "paint.sand": "Arena", "paint.woodbrass": "Madera y latón", "paint.gunmetal": "Gris metal", "paint.twotone": "Negro con muebles arena", "paint.parkerized": "Fosfatado y nogal", "paint.fde": "Tierra oscura (FDE)", "paint.olive": "Verde oliva", "paint.gray": "Gris tormenta", "paint.rust": "Oxidado",
  "slot.stock": "Culata", "slot.grip": "Empuñadura", "slot.front": "Guardamanos", "slot.trigger": "Gatillo", "slot.charging": "Palanca de carga", "slot.pump": "Corredera de bombeo", "slot.device": "Bajo el raíl", "role.receiver": "Cajón", "role.stock": "Culata", "role.grip": "Empuñadura", "role.front": "Guardamanos",
  "slot.magazine": "Cargador", "slot.scope": "Mira", "slot.muzzle": "Boca", "slot.slide": "Corredera", "slot.frame": "Armazón", "slot.barrel": "Cañón",
  "role.body": "Cuerpo", "role.frame": "Armazón", "role.slide": "Corredera", "role.barrel": "Cañón", "role.magazine": "Cargador", "role.scope": "Mira", "role.muzzle": "Boca",
  "acc.suppressor-s": "Supresor corto", "acc.suppressor-l": "Supresor largo", "acc.compensator": "Compensador", "acc.brake": "Freno de boca", "acc.flashhider": "Apagallamas",
  "acc.reddot": "Punto rojo", "acc.holo": "Holográfica", "acc.acog": "Mira de combate 4x", "acc.scope6": "Visor 6x",
  "dummy.small": "Blanco pequeño", "dummy.large": "Blanco grande", "dummy.basic": "Maniquí", "dummy.armored": "Maniquí blindado", "dummy.shielded": "Maniquí con escudo", "dummy.elite": "Élite de prueba", "dummy.boss": "Coloso de prueba",
  "ui.play": "Entrar al campo", "ui.resume": "Volver al campo", "ui.pause": "Pausa", "ui.title": "Campo de Pruebas",
  "ui.eyebrow": "Demo jugable · Fase 1", "ui.language": "Idioma",
  "ui.intro": "Un campo de tiro para probar las armas procedurales. Abre el cofre para conseguir armas nuevas, personalízalas en el banco de trabajo y pruébalas contra muñecos con escudo, armadura y vida. Los muñecos se levantan al caer.",
  "ui.kbm": "Teclado y ratón", "ui.pad": "Mando",
  "c.move": "moverse", "c.look": "apuntar", "c.fire": "disparar / apuntar con mira", "c.reload": "recargar", "c.swap": "cambiar de arma", "c.sprint": "correr · saltar", "c.use": "recoger / cofre / banco de trabajo", "c.inv": "inventario", "c.pause": "pausa", "c.inspect": "inspeccionar el arma",
  "c.sticks": "moverse · apuntar (con asistencia)", "c.menus": "En menús", "c.menus.d": "stick izq. mueve el cursor, Ⓐ clic, Ⓑ volver, RB soltar",
  "ui.inventory": "Inventario", "ui.equipped": "Equipadas", "ui.backpack": "Mochila", "ui.slot": "Ranura {n}", "ui.empty": "Vacío", "ui.dropHere": "Coloca aquí un arma",
  "ui.invKeys": "Arrastra o haz clic para mover · Clic der. equipar / guardar · G soltar al suelo · X desguazar (mochila) · Tab cerrar",
  "ui.inHand": "EN MANO", "ui.compared": "Comparada con el arma en mano", "ui.preview": "Vista previa del cambio",
  "ui.packCount": "Mochila", "ui.looseParts": "Piezas sueltas", "ui.scrap": "Chatarra",
  "ui.workbench": "Banco de trabajo", "ui.benchKeys": "Elige un arma · pasa el cursor por una pieza para ver el cambio · E cerrar", "ui.yourWeapons": "Tus armas", "ui.parts": "Piezas",
  "ui.drag": "Arrastra para girar", "ui.noWeapons": "No tienes armas. Abre el cofre.", "ui.remove": "Quitar", "ui.noParts": "Sin piezas compatibles en la caja",
  "ui.finish": "Acabado", "ui.partsBox": "Caja de piezas", "ui.partsBoxInfo": "{n} piezas · {s} chatarra", "ui.partsEmpty": "Vacía. Desguaza armas para conseguir piezas.", "ui.scrapWeapon": "Desguazar esta arma",
  "ui.scrapped": "Desguazada: +{p} piezas, +{s} de chatarra", "ui.packFull": "Mochila llena: desguaza alguna arma",
  "ui.openCrate": "Abrir cofre", "ui.useBench": "Usar banco de trabajo", "ui.equippedTo": "Equipada", "ui.storedIn": "Guardada en la mochila", "ui.tabToSee": "Tab para ver el inventario",
  "ui.reloading": "recargando…", "ui.pixelLevel": "Pixelado de texturas: {n} px", "ui.waveDone": "Oleada {n} superada", "ui.wavesDone": "Todas las oleadas superadas", "ui.simReset": "Simulación reiniciada", "ui.waveN": "Oleada {n}/{of} · quedan {left}", "ui.wavesStart": "Empezar oleadas de prueba", "ui.wavesStop": "Parar oleadas", "ui.wavesGo": "Llegan oleadas", "ui.inspect": "Banco de inspección", "ui.dmgOn": "Números de daño activados", "ui.night": "Campo de tiro de noche (neón)", "ui.day": "Campo de tiro de día", "ui.dmgOff": "Números de daño desactivados", "ui.equippedNow": "Equipada", "sim.data": "DATOS SIM", "sim.ttk": "T. BAJA", "sim.acc": "PRECISIÓN", "sim.dist": "DIST", "sim.active": "SIMULACIÓN ACTIVA", "sim.calibrating": "CALIBRANDO", "ui.pickup": "Recoger", "ui.dropZone": "Arrastra aquí un arma para soltarla al suelo", "ui.dropped": "Has soltado {n}", "ui.noWeapon": "Sin arma", "ui.fists": "Puños", "ui.bossDown": "¡Coloso derribado!",
  "hint.kbm": "<kbd>Clic</kbd>disparar <kbd>Clic der.</kbd>apuntar <kbd>R</kbd>recargar <kbd>1</kbd><kbd>2</kbd>armas <kbd>F</kbd>inspeccionar <kbd>E</kbd>usar <kbd>Tab</kbd>inventario",
  "hint.pad": "<kbd>RT</kbd>disparar <kbd>LT</kbd>apuntar <kbd>Ⓧ</kbd>recargar <kbd>Ⓨ</kbd>cambiar <kbd>Ⓑ</kbd>usar <kbd>View</kbd>inventario",
  "ui.loadError": "No se pudo cargar el juego: {e}",
};

import { MENUS_EN, MENUS_ES } from "./i18n-menus";
Object.assign(en, MENUS_EN); Object.assign(es, MENUS_ES);
const DICTS: Record<Lang, Dict> = { en, es };
/** ¿Existe la clave en ese idioma? (para el test de textos completos) */
export const hasKey = (l: Lang, key: string) => key in DICTS[l];
export const LANGS: { id: Lang; name: string }[] = [{ id: "en", name: "English" }, { id: "es", name: "Español" }];

function initial(): Lang { try { const v = localStorage.getItem("lang"); if (v === "en" || v === "es") return v; } catch { /* sin almacenamiento */ } return "en"; }
let lang: Lang = initial();
const listeners: (() => void)[] = [];

export const getLang = () => lang;
export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem("lang", l); } catch { /* sin almacenamiento */ }
  if (typeof document !== "undefined") { document.documentElement.lang = l; applyStatic(); }
  for (const f of listeners) f();
}
export const onLang = (f: () => void) => { listeners.push(f); };

/** Traduce una clave; {x} se sustituye por params.x. Si falta, devuelve la clave. */
export function t(key: string, params?: Record<string, string | number>): string {
  let s = DICTS[lang][key] ?? DICTS.en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Rellena los elementos con data-i18n (texto) o data-i18n-html (HTML). */
export function applyStatic(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n!); });
  root.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml!); });
}
