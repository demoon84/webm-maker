const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const {spawnSync} = require('child_process');
const {
	convert,
	frames2webm,
	inspect,
	resolveFfmpegPath,
	video2webm
} = require('../src/index');

async function main() {
	const projectRoot = path.resolve(__dirname, '..');
	const tempRoot = path.join(projectRoot, '.tmp-smoke');
	const framesDir = path.join(tempRoot, 'frames');
	const cliPath = path.join(projectRoot, 'bin', 'webm-maker.js');
	const ffmpegPath = resolveFfmpegPath();

	fs.rmSync(tempRoot, {recursive: true, force: true});
	fs.mkdirSync(framesDir, {recursive: true});

	try {
		createPngFixtures(framesDir);

		const sourceVideoPath = path.join(tempRoot, 'source.mp4');
		createMp4Fixture(ffmpegPath, sourceVideoPath);

		await testLibraryApi(framesDir, sourceVideoPath, tempRoot, ffmpegPath);
		testCli(framesDir, sourceVideoPath, tempRoot, cliPath, ffmpegPath);
	} finally {
		fs.rmSync(tempRoot, {recursive: true, force: true});
	}
}

function createPngFixtures(framesDir) {
	for (let index = 1; index <= 3; index += 1) {
		const color = [index * 40, 90, 210 - index * 30, 255];
		fs.writeFileSync(path.join(framesDir, `${index}.png`), createPngBuffer(color));
	}
}

function createMp4Fixture(ffmpegPath, sourceVideoPath) {
	const result = spawnSync(ffmpegPath, [
		'-y',
		'-hide_banner',
		'-loglevel', 'error',
		'-f', 'lavfi',
		'-i', 'testsrc=size=64x64:rate=12:duration=1',
		'-c:v', 'mpeg4',
		'-q:v', '4',
		sourceVideoPath
	], {
		encoding: 'utf8'
	});

	assert.equal(result.status, 0, result.stderr);
	assert.equal(fs.existsSync(sourceVideoPath), true);
}

async function testLibraryApi(framesDir, sourceVideoPath, tempRoot, ffmpegPath) {
	const framesOutputPath = path.join(tempRoot, 'api-frames', 'sequence.webm');
	const videoOutputPath = path.join(tempRoot, 'api-video', 'video.webm');
	const autoFramesPath = path.join(tempRoot, 'api-auto', 'frames.webm');
	const autoVideoPath = path.join(tempRoot, 'api-auto', 'video.webm');
	const inspectedFrames = inspect({
		from: framesDir
	});

	assert.equal(inspectedFrames.command, 'inspect');
	assert.equal(inspectedFrames.sourceType, 'frames');
	assert.equal(inspectedFrames.frameCount, 3);
	assert.equal(inspectedFrames.convertible, true);

	const framesResult = await frames2webm({
		from: framesDir,
		to: framesOutputPath,
		fps: 12,
		crf: 30,
		log: false
	});

	assert.equal(framesResult.count, 3);
	assert.equal(framesResult.command, 'frames2webm');
	assert.equal(fs.existsSync(framesOutputPath), true);
	assertValidVideo(ffmpegPath, framesOutputPath);

	const videoResult = await video2webm({
		from: sourceVideoPath,
		to: videoOutputPath,
		crf: 30,
		mute: true,
		log: false
	});

	assert.equal(videoResult.command, 'video2webm');
	assert.equal(videoResult.mute, true);
	assert.equal(fs.existsSync(videoOutputPath), true);
	assertValidVideo(ffmpegPath, videoOutputPath);

	const autoFrames = await convert({
		from: framesDir,
		to: autoFramesPath,
		fps: 12,
		log: false
	});

	assert.equal(autoFrames.command, 'frames2webm');
	assert.equal(fs.existsSync(autoFramesPath), true);
	assertValidVideo(ffmpegPath, autoFramesPath);

	const autoVideo = await convert({
		from: sourceVideoPath,
		to: autoVideoPath,
		log: false
	});

	assert.equal(autoVideo.command, 'video2webm');
	assert.equal(fs.existsSync(autoVideoPath), true);
	assertValidVideo(ffmpegPath, autoVideoPath);
}

function testCli(framesDir, sourceVideoPath, tempRoot, cliPath, ffmpegPath) {
	const cliFramesPath = path.join(tempRoot, 'cli-frames', 'sequence.webm');
	const cliVideoPath = path.join(tempRoot, 'cli-video', 'video.webm');
	const cliAutoPath = path.join(tempRoot, 'cli-auto', 'video.webm');
	const cliImplicitPath = path.join(tempRoot, 'cli-auto', 'frames.webm');
	const cliStdinPath = path.join(tempRoot, 'cli-stdin', 'video.webm');
	const configPath = path.join(tempRoot, 'convert.config.json');
	const inspectResult = spawnSync(process.execPath, [
		cliPath,
		'inspect',
		'--from', framesDir,
		'--json', 'true'
	], {
		encoding: 'utf8'
	});

	assert.equal(inspectResult.status, 0, inspectResult.stderr);

	const inspectPayload = JSON.parse(inspectResult.stdout);

	assert.equal(inspectPayload.ok, true);
	assert.equal(inspectPayload.result.command, 'inspect');
	assert.equal(inspectPayload.result.sourceType, 'frames');
	assert.equal(inspectPayload.result.frameCount, 3);

	const framesResult = spawnSync(process.execPath, [
		cliPath,
		'frames2webm',
		'--from', framesDir,
		'--to', cliFramesPath,
		'--fps', '12',
		'--json'
	], {
		encoding: 'utf8'
	});

	assert.equal(framesResult.status, 0, framesResult.stderr);

	const framesPayload = JSON.parse(framesResult.stdout);

	assert.equal(framesPayload.ok, true);
	assert.equal(framesPayload.result.command, 'frames2webm');
	assert.equal(framesPayload.result.count, 3);
	assert.equal(fs.existsSync(cliFramesPath), true);
	assertValidVideo(ffmpegPath, cliFramesPath);

	const videoResult = spawnSync(process.execPath, [
		cliPath,
		'video2webm',
		'--from', sourceVideoPath,
		'--to', cliVideoPath,
		'--mute',
		'--json'
	], {
		encoding: 'utf8'
	});

	assert.equal(videoResult.status, 0, videoResult.stderr);

	const videoPayload = JSON.parse(videoResult.stdout);

	assert.equal(videoPayload.ok, true);
	assert.equal(videoPayload.result.command, 'video2webm');
	assert.equal(videoPayload.result.mute, true);
	assert.equal(fs.existsSync(cliVideoPath), true);
	assertValidVideo(ffmpegPath, cliVideoPath);

	const implicitConvertResult = spawnSync(process.execPath, [
		cliPath,
		'--from', framesDir,
		'--to', cliImplicitPath,
		'--fps', '12',
		'--json', 'true'
	], {
		encoding: 'utf8'
	});

	assert.equal(implicitConvertResult.status, 0, implicitConvertResult.stderr);

	const implicitPayload = JSON.parse(implicitConvertResult.stdout);

	assert.equal(implicitPayload.ok, true);
	assert.equal(implicitPayload.command, 'convert');
	assert.equal(implicitPayload.result.command, 'frames2webm');
	assert.equal(fs.existsSync(cliImplicitPath), true);
	assertValidVideo(ffmpegPath, cliImplicitPath);

	fs.writeFileSync(configPath, JSON.stringify({
		from: sourceVideoPath,
		to: cliAutoPath,
		mute: true
	}, null, 2));

	const autoResult = spawnSync(process.execPath, [
		cliPath,
		'convert',
		'--config', configPath,
		'--json'
	], {
		encoding: 'utf8'
	});

	assert.equal(autoResult.status, 0, autoResult.stderr);

	const autoPayload = JSON.parse(autoResult.stdout);

	assert.equal(autoPayload.ok, true);
	assert.equal(autoPayload.command, 'convert');
	assert.equal(autoPayload.result.command, 'video2webm');
	assert.equal(fs.existsSync(cliAutoPath), true);
	assertValidVideo(ffmpegPath, cliAutoPath);

	const stdinConfigResult = spawnSync(process.execPath, [
		cliPath,
		'convert',
		'--config', '-',
		'--json', 'true'
	], {
		encoding: 'utf8',
		input: JSON.stringify({
			from: sourceVideoPath,
			to: cliStdinPath,
			mute: true
		})
	});

	assert.equal(stdinConfigResult.status, 0, stdinConfigResult.stderr);

	const stdinPayload = JSON.parse(stdinConfigResult.stdout);

	assert.equal(stdinPayload.ok, true);
	assert.equal(stdinPayload.result.command, 'video2webm');
	assert.equal(stdinPayload.result.mute, true);
	assert.equal(fs.existsSync(cliStdinPath), true);
	assertValidVideo(ffmpegPath, cliStdinPath);
}

function assertValidVideo(ffmpegPath, filePath) {
	const result = spawnSync(ffmpegPath, [
		'-v', 'error',
		'-i', filePath,
		'-f', 'null',
		'-'
	], {
		encoding: 'utf8'
	});

	assert.equal(result.status, 0, result.stderr);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});

function createPngBuffer([red, green, blue, alpha]) {
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	const ihdr = Buffer.alloc(13);

	ihdr.writeUInt32BE(1, 0);
	ihdr.writeUInt32BE(1, 4);
	ihdr[8] = 8;
	ihdr[9] = 6;
	ihdr[10] = 0;
	ihdr[11] = 0;
	ihdr[12] = 0;

	const pixel = Buffer.from([0, red, green, blue, alpha]);
	const idat = zlib.deflateSync(pixel);

	return Buffer.concat([
		signature,
		makeChunk('IHDR', ihdr),
		makeChunk('IDAT', idat),
		makeChunk('IEND', Buffer.alloc(0))
	]);
}

function makeChunk(type, data) {
	const typeBuffer = Buffer.from(type, 'ascii');
	const lengthBuffer = Buffer.alloc(4);
	const crcBuffer = Buffer.alloc(4);
	const payload = Buffer.concat([typeBuffer, data]);

	lengthBuffer.writeUInt32BE(data.length, 0);
	crcBuffer.writeUInt32BE(crc32(payload), 0);

	return Buffer.concat([lengthBuffer, payload, crcBuffer]);
}

function crc32(buffer) {
	let crc = 0xffffffff;

	for (const value of buffer) {
		crc ^= value;

		for (let bit = 0; bit < 8; bit += 1) {
			if ((crc & 1) === 1) {
				crc = (crc >>> 1) ^ 0xedb88320;
			} else {
				crc >>>= 1;
			}
		}
	}

	return (crc ^ 0xffffffff) >>> 0;
}
