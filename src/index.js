const fs = require('fs');
const path = require('path');
const FramesToWebm = require('./framesToWebm');
const VideoToWebm = require('./videoToWebm');
const {
	collectPngFiles,
	ensureValue,
	isSupportedVideoFile
} = require('./util');
const {resolveFfmpegPath} = require('./ffmpeg');

function frames2webm(config) {
	return new FramesToWebm(config).run();
}

function video2webm(config) {
	return new VideoToWebm(config).run();
}

function inspect(config = {}) {
	ensureValue(config.from, 'from');

	const summary = {
		command: 'inspect',
		from: config.from,
		absoluteFrom: path.resolve(config.from),
		ffmpegPath: resolveFfmpegPath(config.ffmpegPath)
	};

	if (!fs.existsSync(config.from)) {
		return {
			...summary,
			exists: false,
			convertible: false,
			sourceType: 'missing',
			reason: `Source path not found: ${config.from}`
		};
	}

	if (fs.lstatSync(config.from).isDirectory()) {
		const files = collectPngFiles(config.from);

		return {
			...summary,
			exists: true,
			convertible: files.length > 0,
			sourceType: 'frames',
			frameCount: files.length,
			firstFrame: files[0] || null,
			lastFrame: files[files.length - 1] || null,
			reason: files.length > 0 ? '' : `No png files found in ${config.from}`
		};
	}

	if (isSupportedVideoFile(config.from)) {
		return {
			...summary,
			exists: true,
			convertible: true,
			sourceType: 'video',
			extension: path.extname(config.from).toLowerCase()
		};
	}

	return {
		...summary,
		exists: true,
		convertible: false,
		sourceType: 'unknown',
		extension: path.extname(config.from).toLowerCase(),
		reason: `Unsupported source path: ${config.from}`
	};
}

function convert(config = {}) {
	const source = inspect(config);

	if (source.sourceType === 'frames' && source.convertible) {
		return frames2webm(config);
	}

	if (source.sourceType === 'video' && source.convertible) {
		return video2webm(config);
	}

	throw new Error(source.reason || `Unsupported source path: ${config.from}`);
}

module.exports = {
	convert,
	frames2webm,
	inspect,
	resolveFfmpegPath,
	video2webm
};
