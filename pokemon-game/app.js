const POKEDEX = [
	{ id: 1, name: 'Bulbasaur', type: 'grass', level: 8, hp: 44, attack: 49, defense: 49, speed: 45, moves: [
		{ name: 'Tackle', type: 'normal', power: 40, accuracy: 100 },
		{ name: 'Vine Whip', type: 'grass', power: 45, accuracy: 100 },
		{ name: 'Growl', type: 'normal', power: 0, accuracy: 100, effect: 'debuff' },
		{ name: 'Leech Seed', type: 'grass', power: 0, accuracy: 90, effect: 'leech' }
	]},
	{ id: 4, name: 'Charmander', type: 'fire', level: 8, hp: 39, attack: 52, defense: 43, speed: 65, moves: [
		{ name: 'Scratch', type: 'normal', power: 40, accuracy: 100 },
		{ name: 'Ember', type: 'fire', power: 40, accuracy: 100 },
		{ name: 'Growl', type: 'normal', power: 0, accuracy: 100, effect: 'debuff' },
		{ name: 'Smokescreen', type: 'normal', power: 0, accuracy: 100, effect: 'accuracyDown' }
	]},
	{ id: 7, name: 'Squirtle', type: 'water', level: 8, hp: 44, attack: 48, defense: 65, speed: 43, moves: [
		{ name: 'Tackle', type: 'normal', power: 40, accuracy: 100 },
		{ name: 'Water Gun', type: 'water', power: 40, accuracy: 100 },
		{ name: 'Tail Whip', type: 'normal', power: 0, accuracy: 100, effect: 'debuff' },
		{ name: 'Withdraw', type: 'water', power: 0, accuracy: 100, effect: 'defUp' }
	]},
	{ id: 25, name: 'Pikachu', type: 'electric', level: 8, hp: 35, attack: 55, defense: 40, speed: 90, moves: [
		{ name: 'Quick Attack', type: 'normal', power: 40, accuracy: 100 },
		{ name: 'Thunder Shock', type: 'electric', power: 40, accuracy: 100 },
		{ name: 'Growl', type: 'normal', power: 0, accuracy: 100, effect: 'debuff' },
		{ name: 'Agility', type: 'psychic', power: 0, accuracy: 100, effect: 'speedUp' }
	]},
];

const TYPE_CHART = {
	fire: { grass: 2, water: 0.5, electric: 1, fire: 0.5 },
	water: { fire: 2, grass: 0.5, electric: 1, water: 0.5 },
	grass: { water: 2, fire: 0.5, electric: 1, grass: 0.5 },
	electric: { water: 2, grass: 0.5, electric: 0.5, fire: 1 },
	normal: { fire: 1, water: 1, grass: 1, electric: 1 }
};

function getTypeMultiplier(moveType, defenderType) {
	const row = TYPE_CHART[moveType] || {};
	return row[defenderType] || 1;
}

function clamp(num, min, max) { return Math.max(min, Math.min(max, num)); }

function calcDamage(attacker, defender, move) {
	if (!move.power || move.power <= 0) return 0;
	const level = attacker.level;
	const power = move.power;
	const attack = attacker.attack;
	const defense = defender.defense;
	const stab = move.type === attacker.type ? 1.5 : 1.0;
	const type = getTypeMultiplier(move.type, defender.type);
	const random = 0.85 + Math.random() * 0.15;
	let damage = (((2 * level) / 5 + 2) * power * (attack / defense)) / 50 + 2;
	damage *= stab * type * random;
	return Math.floor(damage);
}

function createBattleState(playerMon, enemyMon) {
	return {
		player: { ...playerMon, currentHp: playerMon.hp, accMod: 0, defMod: 0, spdMod: 0, leech: 0 },
		enemy: { ...enemyMon, currentHp: enemyMon.hp, accMod: 0, defMod: 0, spdMod: 0, leech: 0 },
		turn: 'player',
		inProgress: false,
		log: []
	};
}

function log(state, text) {
	state.log.push(text);
	const li = document.createElement('li');
	li.textContent = text;
	document.getElementById('log').appendChild(li);
	const el = document.getElementById('log-panel') || document.querySelector('.log-panel');
	if (el) el.scrollTop = el.scrollHeight;
}

function renderMon(prefix, mon) {
	document.getElementById(prefix + '-name').textContent = mon.name;
	document.getElementById(prefix + '-level').textContent = 'Lv ' + mon.level;
	document.getElementById(prefix + '-type').textContent = mon.type;
	const hpPct = (mon.currentHp / mon.hp) * 100;
	const hpFill = document.getElementById(prefix + '-hp');
	hpFill.style.width = clamp(hpPct, 0, 100) + '%';
	hpFill.style.background = hpPct < 25 ? 'var(--hp-red)' : hpPct < 50 ? 'var(--hp-yellow)' : 'var(--hp-green)';
	const sprite = document.getElementById(prefix + '-sprite');
	sprite.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${mon.id}.png`;
}

function updateUI(state) {
	renderMon('player', state.player);
	renderMon('enemy', state.enemy);
	const movesEl = document.getElementById('moves');
	movesEl.innerHTML = '';
	state.player.moves.forEach((m, idx) => {
		const btn = document.createElement('button');
		btn.textContent = `${m.name} — ${m.type}${m.power ? ' (' + m.power + ')' : ''}`;
		btn.onclick = () => onPlayerMove(state, idx);
		btn.disabled = !state.inProgress || state.turn !== 'player' || state.player.currentHp <= 0 || state.enemy.currentHp <= 0;
		movesEl.appendChild(btn);
	});
	document.getElementById('btn-start').disabled = state.inProgress;
	document.getElementById('btn-reset').disabled = !state.inProgress;
}

function accuracyCheck(baseAcc, accMod) {
	const stages = clamp(accMod, -6, 6);
	const stageMultipliers = [
		3/9, 3/8, 3/7, 3/6, 3/5, 3/4, 1, 4/3, 5/3, 6/3, 7/3, 8/3, 9/3
	];
	const effective = baseAcc * stageMultipliers[stages + 6];
	return Math.random() * 100 <= effective;
}

function endOfTurnEffects(state) {
	['player', 'enemy'].forEach(side => {
		const mon = state[side];
		if (mon.leech > 0 && mon.currentHp > 0) {
			const dmg = Math.max(1, Math.floor(mon.hp * 0.05));
			mon.currentHp = clamp(mon.currentHp - dmg, 0, mon.hp);
			const other = side === 'player' ? state.enemy : state.player;
			other.currentHp = clamp(other.currentHp + dmg, 0, other.hp);
			log(state, `${other.name} drained ${dmg} HP from ${mon.name}!`);
		}
	});
}

function applyMove(state, attackerSide, moveIdx) {
	const defenderSide = attackerSide === 'player' ? 'enemy' : 'player';
	const attacker = state[attackerSide];
	const defender = state[defenderSide];
	const move = attacker.moves[moveIdx];

	if (!accuracyCheck(move.accuracy || 100, attacker.accMod)) {
		log(state, `${attacker.name}'s ${move.name} missed!`);
		return;
	}

	if (move.effect === 'debuff') {
		defender.defMod = clamp(defender.defMod - 1, -6, 6);
		log(state, `${defender.name}'s Defense fell!`);
		return;
	}
	if (move.effect === 'defUp') {
		attacker.defMod = clamp(attacker.defMod + 1, -6, 6);
		log(state, `${attacker.name}'s Defense rose!`);
		return;
	}
	if (move.effect === 'speedUp') {
		attacker.spdMod = clamp(attacker.spdMod + 1, -6, 6);
		log(state, `${attacker.name}'s Speed rose!`);
		return;
	}
	if (move.effect === 'accuracyDown') {
		defender.accMod = clamp(defender.accMod - 1, -6, 6);
		log(state, `${defender.name}'s Accuracy fell!`);
		return;
	}
	if (move.effect === 'leech') {
		if (defender.leech === 0) {
			defender.leech = 1;
			log(state, `${defender.name} was seeded!`);
		} else {
			log(state, `${defender.name} is already seeded.`);
		}
		return;
	}

	const defStageMult = defender.defMod >= 0 ? (2 + defender.defMod)/2 : 2/(2 - defender.defMod);
	const atkAdjusted = Math.max(1, Math.floor(attacker.attack));
	const defAdjusted = Math.max(1, Math.floor(defender.defense * defStageMult));
	const tempAttacker = { ...attacker, attack: atkAdjusted };
	const tempDefender = { ...defender, defense: defAdjusted };
	const damage = clamp(calcDamage(tempAttacker, tempDefender, move), 1, 9999);
	defender.currentHp = clamp(defender.currentHp - damage, 0, defender.hp);
	const multiplier = getTypeMultiplier(move.type, defender.type);
	log(state, `${attacker.name} used ${move.name}! ${multiplier > 1 ? 'It\'s super effective! ' : multiplier < 1 ? 'It\'s not very effective. ' : ''}It dealt ${damage} damage.`);
}

function pickEnemyMove(state) {
	const moves = state.enemy.moves;
	const offensive = moves.filter(m => (m.power || 0) > 0);
	return offensive.length ? moves.indexOf(offensive[Math.floor(Math.random() * offensive.length)]) : Math.floor(Math.random() * moves.length);
}

function onPlayerMove(state, moveIdx) {
	if (!state.inProgress || state.turn !== 'player') return;
	applyMove(state, 'player', moveIdx);
	updateUI(state);
	if (state.enemy.currentHp <= 0) { endBattle(state, 'You win!'); return; }
	state.turn = 'enemy';
	setTimeout(() => {
		applyMove(state, 'enemy', pickEnemyMove(state));
		updateUI(state);
		if (state.player.currentHp <= 0) { endBattle(state, 'You lose...'); return; }
		endOfTurnEffects(state);
		updateUI(state);
		state.turn = 'player';
	}, 600);
}

function endBattle(state, message) {
	state.inProgress = false;
	log(state, message);
	updateUI(state);
}

function hydrateSelects(selectId, mons) {
	const sel = document.getElementById(selectId);
	sel.innerHTML = '';
	mons.forEach((m, i) => {
		const opt = document.createElement('option');
		opt.value = String(i);
		opt.textContent = `${m.name} — ${m.type} (Lv ${m.level})`;
		sel.appendChild(opt);
	});
}

function init() {
	hydrateSelects('player-select', POKEDEX);
	hydrateSelects('enemy-select', POKEDEX);
	const defaultPlayer = 3; // Pikachu
	const defaultEnemy = 0; // Bulbasaur
	document.getElementById('player-select').value = String(defaultPlayer);
	document.getElementById('enemy-select').value = String(defaultEnemy);

	let state = createBattleState(POKEDEX[defaultPlayer], POKEDEX[defaultEnemy]);
	updateUI(state);

	document.getElementById('btn-start').addEventListener('click', () => {
		const pIdx = Number(document.getElementById('player-select').value);
		const eIdx = Number(document.getElementById('enemy-select').value);
		state = createBattleState(POKEDEX[pIdx], POKEDEX[eIdx]);
		state.inProgress = true;
		document.getElementById('log').innerHTML = '';
		log(state, `A wild ${state.enemy.name} appeared! Go, ${state.player.name}!`);
		updateUI(state);
	});

	document.getElementById('btn-reset').addEventListener('click', () => {
		state = createBattleState(state.player, state.enemy);
		state.inProgress = false;
		document.getElementById('log').innerHTML = '';
		updateUI(state);
	});
}

document.addEventListener('DOMContentLoaded', init);