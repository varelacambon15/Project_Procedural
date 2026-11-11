// Textos del juego. Inglés por defecto; español como segunda lengua. Se elige en el menú principal.
export type Lang = "en" | "es";
type Dict = Record<string, string>;

const en: Dict = {
  // Rarezas y tipos
  "rarity.comun": "Common", "rarity.poco": "Uncommon", "rarity.rara": "Rare", "rarity.epica": "Epic", "rarity.legendaria": "Legendary",
  "type.pistol": "Pistol", "type.revolver": "Revolver", "type.smg": "SMG", "type.rifle": "Rifle", "type.bullpup": "Bullpup",
  "type.shotgun": "Shotgun", "type.sniper": "Sniper Rifle", "type.launcher": "Launcher", "type.flamethrower": "Flamethrower", "type.lmg": "Machine Gun",
  // Variantes (arquetipos)
  "arch.standard": "Standard", "arch.machine": "Machine pistol", "arch.heavy": "Heavy", "arch.quick": "Quick-draw", "arch.rapid": "Rapid-fire",
  "arch.tactical": "Tactical", "arch.auto": "Automatic", "arch.burst": "Burst", "arch.marksman": "Marksman", "arch.pump": "Pump-action",
  "arch.semi": "Semi-auto", "arch.double": "Double-barrel", "arch.bolt": "Bolt-action", "arch.antimateriel": "Anti-materiel", "arch.minigun": "Rotary",
  "mode.auto": "Auto", "mode.semi": "Semi", "mode.burst": "Burst", "mode.pump": "Pump", "mode.bolt": "Bolt",
  // Estadísticas
  "stat.dano": "Damage", "stat.cadencia": "Fire rate", "stat.precision": "Accuracy", "stat.alcance": "Range", "stat.manejo": "Handling", "stat.cargador": "Magazine",
  "unit.rpm": "/min", "unit.m": "m", "label.damage": "damage", "label.level": "Lv",
  // Habilidades
  "fx.fuego": "Incendiary", "fx.fuego.d": "{v}% chance to set the target on fire.",
  "fx.corrosivo": "Corrosive", "fx.corrosivo.d": "{v}% chance to corrode. +75% damage to armor.",
  "fx.electrico": "Shock", "fx.electrico.d": "{v}% chance to electrocute. +75% damage to shields.",
  "fx.radiacion": "Radioactive", "fx.radiacion.d": "{v}% chance to irradiate: damage over time.",
  "fx.extmag": "Extended Mag", "fx.extmag.d": "+{v}% magazine size.",
  "fx.quickdraw": "Quickdraw", "fx.quickdraw.d": "Ready and aim this weapon much faster.",
  "fx.steady": "Steady Hands", "fx.steady.d": "-{v}% recoil.",
  "fx.headhunter": "Headhunter", "fx.headhunter.d": "+{v}% precision (headshot) damage.",
  "fx.opening": "Opening Shot", "fx.opening.d": "The first shot from a full magazine deals +{v}% damage.",
  "fx.reload": "Rapid Reload", "fx.reload.d": "Reloading an empty magazine is {v}% faster.",
  "fx.range": "Rangefinder", "fx.range.d": "+{v}% effective range.",
  "fx.rebote": "Ricochet", "fx.rebote.d": "Bullets bounce to the nearest enemy for half damage.",
  "fx.doble": "Twin Barrel", "fx.doble.d": "Fires 2 projectiles per shot. More recoil.",
  "fx.eco": "Echo", "fx.eco.d": "Every 5th shot is repeated for free half a second later.",
  "fx.carronero": "Scavenger", "fx.carronero.d": "Kills put 3 rounds back in the magazine.",
  "fx.explosive": "Detonator", "fx.explosive.d": "Bullets explode on impact, damaging nearby enemies.",
  "fx.chain": "Arc Chain", "fx.chain.d": "Hits arc to 2 nearby enemies.",
  "fx.frenzy": "Frenzy", "fx.frenzy.d": "Kills grant +50% fire rate for 5 seconds.",
  "fx.piercing": "Penetrator", "fx.piercing.d": "Bullets pass through targets.",
  // Acabados y piezas
  "paint.original": "Factory", "paint.black": "Matte black", "paint.fde": "Flat dark earth", "paint.olive": "Olive drab", "paint.gray": "Storm gray", "paint.rust": "Worn rust",
  "slot.magazine": "Magazine", "slot.scope": "Optic", "slot.muzzle": "Muzzle", "slot.slide": "Slide", "slot.frame": "Frame", "slot.barrel": "Barrel",
  "role.body": "Body", "role.frame": "Frame", "role.slide": "Slide", "role.barrel": "Barrel", "role.magazine": "Magazine", "role.scope": "Optic", "role.muzzle": "Muzzle",
  "acc.suppressor-s": "Short suppressor", "acc.suppressor-l": "Long suppressor", "acc.compensator": "Compensator", "acc.brake": "Muzzle brake", "acc.flashhider": "Flash hider",
  "acc.reddot": "Red dot", "acc.holo": "Holographic", "acc.acog": "4x combat scope", "acc.scope6": "6x scope",
  // Muñecos
  "dummy.basic": "Dummy", "dummy.armored": "Armored dummy", "dummy.shielded": "Shielded dummy", "dummy.elite": "Test elite", "dummy.boss": "Test colossus",
  // Interfaz del juego
  "ui.play": "Enter the range", "ui.resume": "Back to the range", "ui.pause": "Paused", "ui.title": "Proving Grounds",
  "ui.eyebrow": "Playable demo · Phase 1", "ui.language": "Language",
  "ui.intro": "A firing range to test the procedural weapons. Open the crate for new guns, customize them at the workbench and try them on dummies with shields, armor and health. Dummies get back up after they fall.",
  "ui.kbm": "Keyboard & mouse", "ui.pad": "Controller",
  "c.move": "move", "c.look": "aim", "c.fire": "fire / aim down sights", "c.reload": "reload", "c.swap": "switch weapon", "c.sprint": "sprint · jump", "c.use": "crate / workbench", "c.inv": "inventory", "c.pause": "pause", "c.inspect": "inspect weapon",
  "c.sticks": "move · aim (with aim assist)", "c.menus": "In menus", "c.menus.d": "left stick moves the cursor, Ⓐ click, Ⓑ back",
  "ui.inventory": "Inventory", "ui.equipped": "Equipped", "ui.backpack": "Backpack", "ui.slot": "Slot {n}", "ui.empty": "Empty", "ui.dropHere": "Place a weapon here",
  "ui.invKeys": "Click pick up / drop · Right-click equip / store · X scrap (backpack) · Tab close",
  "ui.inHand": "IN HAND", "ui.compared": "Compared to your current weapon", "ui.preview": "Preview of the change",
  "ui.packCount": "Backpack", "ui.looseParts": "Loose parts", "ui.scrap": "Scrap",
  "ui.workbench": "Workbench", "ui.benchKeys": "Pick a weapon · hover a part to preview the change · E close", "ui.yourWeapons": "Your weapons", "ui.parts": "Parts",
  "ui.drag": "Drag to rotate", "ui.noWeapons": "No weapons. Open the crate.", "ui.remove": "Remove", "ui.noParts": "No compatible parts in the box",
  "ui.finish": "Finish", "ui.partsBox": "Parts box", "ui.partsBoxInfo": "{n} parts · {s} scrap", "ui.partsEmpty": "Empty. Scrap weapons to get parts.", "ui.scrapWeapon": "Scrap this weapon",
  "ui.scrapped": "Scrapped: +{p} parts, +{s} scrap", "ui.packFull": "Backpack full: scrap a weapon first",
  "ui.openCrate": "Open crate", "ui.useBench": "Use workbench", "ui.equippedTo": "Equipped", "ui.storedIn": "Stored in your backpack", "ui.tabToSee": "Tab to open the inventory",
  "ui.reloading": "reloading…", "ui.noWeapon": "No weapon", "ui.bossDown": "Colossus down!",
  "hint.kbm": "<kbd>Click</kbd>fire <kbd>RMB</kbd>aim <kbd>R</kbd>reload <kbd>1</kbd><kbd>2</kbd>weapons <kbd>F</kbd>inspect <kbd>E</kbd>use <kbd>Tab</kbd>inventory",
  "hint.pad": "<kbd>RT</kbd>fire <kbd>LT</kbd>aim <kbd>Ⓧ</kbd>reload <kbd>Ⓨ</kbd>switch <kbd>Ⓑ</kbd>use <kbd>View</kbd>inventory",
  "ui.loadError": "The game could not load: {e}",
};

const es: Dict = {
  "rarity.comun": "Común", "rarity.poco": "Poco común", "rarity.rara": "Rara", "rarity.epica": "Épica", "rarity.legendaria": "Legendaria",
  "type.pistol": "Pistola", "type.revolver": "Revólver", "type.smg": "Subfusil", "type.rifle": "Fusil", "type.bullpup": "Bullpup",
  "type.shotgun": "Escopeta", "type.sniper": "Francotirador", "type.launcher": "Lanzacohetes", "type.flamethrower": "Lanzallamas", "type.lmg": "Ametralladora",
  "arch.standard": "Estándar", "arch.machine": "Automática", "arch.heavy": "Pesada", "arch.quick": "Rápida", "arch.rapid": "Cadencia alta",
  "arch.tactical": "Táctica", "arch.auto": "Automático", "arch.burst": "Ráfagas", "arch.marksman": "Tirador", "arch.pump": "De corredera",
  "arch.semi": "Semiautomática", "arch.double": "De dos cañones", "arch.bolt": "De cerrojo", "arch.antimateriel": "Antimaterial", "arch.minigun": "Rotativa",
  "mode.auto": "Auto", "mode.semi": "Semi", "mode.burst": "Ráfaga", "mode.pump": "Corredera", "mode.bolt": "Cerrojo",
  "stat.dano": "Daño", "stat.cadencia": "Cadencia", "stat.precision": "Precisión", "stat.alcance": "Alcance", "stat.manejo": "Manejo", "stat.cargador": "Cargador",
  "unit.rpm": "/min", "unit.m": "m", "label.damage": "daño", "label.level": "Nv",
  "fx.fuego": "Incendiaria", "fx.fuego.d": "{v}% de probabilidad de prender fuego al objetivo.",
  "fx.corrosivo": "Corrosiva", "fx.corrosivo.d": "{v}% de corroer. +75% de daño contra armadura.",
  "fx.electrico": "Eléctrica", "fx.electrico.d": "{v}% de electrocutar. +75% de daño contra escudos.",
  "fx.radiacion": "Radiactiva", "fx.radiacion.d": "{v}% de irradiar: daño continuo.",
  "fx.extmag": "Cargador ampliado", "fx.extmag.d": "+{v}% de capacidad del cargador.",
  "fx.quickdraw": "Desenfundado rápido", "fx.quickdraw.d": "Sacas y apuntas esta arma mucho más rápido.",
  "fx.steady": "Pulso firme", "fx.steady.d": "-{v}% de retroceso.",
  "fx.headhunter": "Cazacabezas", "fx.headhunter.d": "+{v}% de daño de precisión (a la cabeza).",
  "fx.opening": "Primer disparo", "fx.opening.d": "El primer disparo de un cargador lleno hace +{v}% de daño.",
  "fx.reload": "Recarga rápida", "fx.reload.d": "Recargar con el cargador vacío es un {v}% más rápido.",
  "fx.range": "Telémetro", "fx.range.d": "+{v}% de alcance efectivo.",
  "fx.rebote": "Rebote", "fx.rebote.d": "Las balas rebotan al enemigo más cercano con la mitad de daño.",
  "fx.doble": "Doble cañón", "fx.doble.d": "Dispara 2 proyectiles por disparo. Más retroceso.",
  "fx.eco": "Eco", "fx.eco.d": "Cada 5.º disparo se repite gratis medio segundo después.",
  "fx.carronero": "Carroñero", "fx.carronero.d": "Cada baja devuelve 3 balas al cargador.",
  "fx.explosive": "Detonador", "fx.explosive.d": "Las balas explotan al impactar y dañan a los enemigos cercanos.",
  "fx.chain": "Arco en cadena", "fx.chain.d": "Los impactos saltan a 2 enemigos cercanos.",
  "fx.frenzy": "Frenesí", "fx.frenzy.d": "Cada baja da +50% de cadencia durante 5 segundos.",
  "fx.piercing": "Perforador", "fx.piercing.d": "Las balas atraviesan los objetivos.",
  "paint.original": "De fábrica", "paint.black": "Negro mate", "paint.fde": "Tierra oscura (FDE)", "paint.olive": "Verde oliva", "paint.gray": "Gris tormenta", "paint.rust": "Óxido gastado",
  "slot.magazine": "Cargador", "slot.scope": "Mira", "slot.muzzle": "Boca", "slot.slide": "Corredera", "slot.frame": "Armazón", "slot.barrel": "Cañón",
  "role.body": "Cuerpo", "role.frame": "Armazón", "role.slide": "Corredera", "role.barrel": "Cañón", "role.magazine": "Cargador", "role.scope": "Mira", "role.muzzle": "Boca",
  "acc.suppressor-s": "Supresor corto", "acc.suppressor-l": "Supresor largo", "acc.compensator": "Compensador", "acc.brake": "Freno de boca", "acc.flashhider": "Apagallamas",
  "acc.reddot": "Punto rojo", "acc.holo": "Holográfica", "acc.acog": "Mira de combate 4x", "acc.scope6": "Visor 6x",
  "dummy.basic": "Maniquí", "dummy.armored": "Maniquí blindado", "dummy.shielded": "Maniquí con escudo", "dummy.elite": "Élite de prueba", "dummy.boss": "Coloso de prueba",
  "ui.play": "Entrar al campo", "ui.resume": "Volver al campo", "ui.pause": "Pausa", "ui.title": "Campo de Pruebas",
  "ui.eyebrow": "Demo jugable · Fase 1", "ui.language": "Idioma",
  "ui.intro": "Un campo de tiro para probar las armas procedurales. Abre el cofre para conseguir armas nuevas, personalízalas en el banco de trabajo y pruébalas contra muñecos con escudo, armadura y vida. Los muñecos se levantan al caer.",
  "ui.kbm": "Teclado y ratón", "ui.pad": "Mando",
  "c.move": "moverse", "c.look": "apuntar", "c.fire": "disparar / apuntar con mira", "c.reload": "recargar", "c.swap": "cambiar de arma", "c.sprint": "correr · saltar", "c.use": "cofre / banco de trabajo", "c.inv": "inventario", "c.pause": "pausa", "c.inspect": "inspeccionar el arma",
  "c.sticks": "moverse · apuntar (con asistencia)", "c.menus": "En menús", "c.menus.d": "stick izq. mueve el cursor, Ⓐ clic, Ⓑ volver",
  "ui.inventory": "Inventario", "ui.equipped": "Equipadas", "ui.backpack": "Mochila", "ui.slot": "Ranura {n}", "ui.empty": "Vacío", "ui.dropHere": "Coloca aquí un arma",
  "ui.invKeys": "Clic coger y soltar · Clic der. equipar / guardar · X desguazar (mochila) · Tab cerrar",
  "ui.inHand": "EN MANO", "ui.compared": "Comparada con el arma en mano", "ui.preview": "Vista previa del cambio",
  "ui.packCount": "Mochila", "ui.looseParts": "Piezas sueltas", "ui.scrap": "Chatarra",
  "ui.workbench": "Banco de trabajo", "ui.benchKeys": "Elige un arma · pasa el cursor por una pieza para ver el cambio · E cerrar", "ui.yourWeapons": "Tus armas", "ui.parts": "Piezas",
  "ui.drag": "Arrastra para girar", "ui.noWeapons": "No tienes armas. Abre el cofre.", "ui.remove": "Quitar", "ui.noParts": "Sin piezas compatibles en la caja",
  "ui.finish": "Acabado", "ui.partsBox": "Caja de piezas", "ui.partsBoxInfo": "{n} piezas · {s} chatarra", "ui.partsEmpty": "Vacía. Desguaza armas para conseguir piezas.", "ui.scrapWeapon": "Desguazar esta arma",
  "ui.scrapped": "Desguazada: +{p} piezas, +{s} de chatarra", "ui.packFull": "Mochila llena: desguaza alguna arma",
  "ui.openCrate": "Abrir cofre", "ui.useBench": "Usar banco de trabajo", "ui.equippedTo": "Equipada", "ui.storedIn": "Guardada en la mochila", "ui.tabToSee": "Tab para ver el inventario",
  "ui.reloading": "recargando…", "ui.noWeapon": "Sin arma", "ui.bossDown": "¡Coloso derribado!",
  "hint.kbm": "<kbd>Clic</kbd>disparar <kbd>Clic der.</kbd>apuntar <kbd>R</kbd>recargar <kbd>1</kbd><kbd>2</kbd>armas <kbd>F</kbd>inspeccionar <kbd>E</kbd>usar <kbd>Tab</kbd>inventario",
  "hint.pad": "<kbd>RT</kbd>disparar <kbd>LT</kbd>apuntar <kbd>Ⓧ</kbd>recargar <kbd>Ⓨ</kbd>cambiar <kbd>Ⓑ</kbd>usar <kbd>View</kbd>inventario",
  "ui.loadError": "No se pudo cargar el juego: {e}",
};

const DICTS: Record<Lang, Dict> = { en, es };
export const LANGS: { id: Lang; name: string }[] = [{ id: "en", name: "English" }, { id: "es", name: "Español" }];

function initial(): Lang { try { const v = localStorage.getItem("lang"); if (v === "en" || v === "es") return v; } catch { /* sin almacenamiento */ } return "en"; }
let lang: Lang = initial();
const listeners: (() => void)[] = [];

export const getLang = () => lang;
export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem("lang", l); } catch { /* sin almacenamiento */ }
  document.documentElement.lang = l;
  applyStatic();
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
