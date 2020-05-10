const MapDecoder = require('./MapDecoder');
const MapEncoder = require('./MapEncoder');
const { attributes, children, findChildWithName } = require('../../utils');
const {
	Apply,
	Decal,
	Effect,
	Entity,
	Filler,
	ObjectTiles,
	Parallax,
	Room,
	Style,
	Tiles,
	Trigger
} = require('../');

class Map {

	constructor() {
		this.package = '';
		this.rooms = [];
		this.style = [];
		this.fillers = [];
	}

	async decode(file) {
		const decoder = new MapDecoder(this, file);
		return await decoder.readMap();
	}

	async encode(data, file) {
		const encoder = new MapEncoder(data);
		await encoder.encode(file);
	}

	load(data) {
		const pkg = data._package;
		const roomsData = findChildWithName(data, 'levels');
		const style = findChildWithName(data, 'Style');
		const fgStyle = this.loadBackdrops(findChildWithName(style, 'Foregrounds'));
		const bgStyle = this.loadBackdrops(findChildWithName(style, 'Backgrounds'));
		const fillerRects = this.loadFillerRects(findChildWithName(data, 'Filler'));
		const rooms = children(roomsData).reduce((a,c) => {
			a.push(this.loadRoom(c));
			return a;
		}, []);

		// this.loadRoom(children(roomsData));

		Object.assign(this, {
			package: pkg,
			rooms,
			style: new Style(fgStyle, bgStyle),
			fillers: fillerRects
		});
	}

	loadBackdrops(styleData) {
		const backdrops = [];

		for (let child of children(styleData)) {
			const styleType = child.__name;

			if (styleType === 'parallax') {
				backdrops.push(new Parallax(attributes(child)));
			} else if (styleType === 'apply') {
				const applyAttr = attributes(child);
				const parallax = [];

				for (let data of children(child)) {
					const typ = data.__name;
					if (typ === 'parallax') {
						parallax.push(new Parallax(attributes(data)));
					} else {
						parallax.push(new Effect(typ, attributes(data)));
					}
				}

				backdrops.push(new Apply(applyAttr, parallax));
			} else {
				backdrops.push(new Effect(styleType, attributes(child)));
			}
		}

		return backdrops;
	}

	loadFillerRects(fillerData) {
		const fillers = [];

		for (let child of children(fillerData)) {
			fillers.push(new Filler(child.x, child.y, child.w, child.h));
		}

		return fillers;
	}

	loadDecals(roomData, isFg = true) {
		const decals = [];
		const key = isFg ? 'fgdecals' : 'bgdecals';

		for (let child of children(findChildWithName(roomData, key))) {
			decals.push(new Decal(child.texture, child.x, child.y, child.scaleX, child.scaleY));
		}

		return decals;
	}

	loadEntities(roomData, key) {
		const entities = [];
		const func = key === 'entities' ? Entity : Trigger;

		for (let child of (children(findChildWithName(roomData, key)))) {
			let id = child.id == null ? -1 : child.id;
			id = Number.isInteger(id) ? id : 0;
			delete child.id;

			const nodesRaw = children(child);

			if (nodesRaw && nodesRaw.length) {
				// child["nodes"] = Tuple{Integer, Integer}[(Int(node["x"]), Int(node["y"])) for node in nodesRaw]
				child.nodes = nodesRaw.reduce((a,c) => {
					a.push([c.x, c.y]);
					return a;
				}, []);
			}
			entities.push(new func(child.__name, attributes(child), id));
		}

		return entities;
	}


	loadRoom(roomData) {
		const fgDecals = this.loadDecals(roomData, true);
		const bgDecals = this.loadDecals(roomData, false);

		const entities = this.loadEntities(roomData, 'entities');
		const triggers = this.loadEntities(roomData, 'triggers');

		const fgTilesRaw = findChildWithName(roomData, 'solids').innerText || '';
		const bgTilesRaw = findChildWithName(roomData, 'bg').innerText || '';
		const objTilesRaw = findChildWithName(roomData, 'objtiles').innerText || '';

		const fgTiles = new Tiles(fgTilesRaw);
		const bgTiles = new Tiles(bgTilesRaw);
		const objTiles = new ObjectTiles(objTilesRaw);

		const room = new Room({
			name: roomData.name || 'lvl_1',
			position: [ roomData.x, roomData.y ],
			size: [ roomData.width, roomData.height ],
			entities,
			triggers,
			bgDecals,
			fgDecals,
			fgTiles,
			bgTiles,
			objTiles,
			musicLayer1: roomData.musicLayer1 || true,
			musicLayer2: roomData.musicLayer2 || true,
			musicLayer3: roomData.musicLayer3 || true,
			musicLayer4: roomData.musicLayer4 || true,
			musicProgress: roomData.musicProgress || '',
			ambienceProgress: roomData.ambienceProgress || '',
			dark: roomData.dark || false,
			space: roomData.space || false,
			underwater: roomData.underwater || false,
			whisper: roomData.whisper || false,
			disableDownTransition: roomData.disableDownTransition || false,
			delayAltMusicFade: roomData.delayAltMusicFade || false,
			music: roomData.music || 'music_oldsite_awake',
			altMusic: roomData.altMusic || '',
			windPattern: roomData.windPattern || 'None',
			color: roomData.c || 0,
			cameraOffsetX: roomData.cameraOffsetX || 0,
			cameraOffsetY: roomData.cameraOffsetY || 0
		});

		room.updateTileSize('0', '0');

		return room;
	}

	toDict() {
		return {
			_package: this.package,
			__name: 'Map',
			__children: [
				{
					__name: 'levels',
					__children: this.rooms.map(r => r.toDict())
				},
				{
					__name: 'Style',
					__children: this.style.toDict()
				},
				{
					__name: 'Filler',
					__children: this.fillers.map(f => f.toDict())
				}
			]
		};
	}

}

module.exports = Map;
