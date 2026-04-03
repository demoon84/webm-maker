const fs = require('fs');
const path = require('path');
const {
	PNG_EXTENSION,
	collectPngFiles,
	ensureDirectory,
	ensureNumber,
	ensureValue,
	isDirectory,
	normalizeString,
	stageFilesAsSequence
} = require('./util');
const {resolveFfmpegPath, runFfmpeg} = require('./ffmpeg');

class FramesToWebm {
	constructor(config = {}) {
		this.config = {
			from: '',
			to: '',
			fps: 30,
			crf: 32,
			bitrate: '0',
			speed: 1,
			scale: '',
			ffmpegPath: '',
			log: true,
			...config
		};
	}

	async run() {
		this.validate();

		const frameFiles = this.detectFrames();
		const staged = stageFilesAsSequence(frameFiles, PNG_EXTENSION);

		try {
			ensureDirectory(path.dirname(this.config.to));

			await runFfmpeg(this.buildArgs(staged.pattern), {
				ffmpegPath: this.config.ffmpegPath
			});
		} finally {
			staged.cleanup();
		}

		const summary = {
			command: 'frames2webm',
			sourceType: 'frames',
			from: this.config.from,
			to: this.config.to,
			fps: this.config.fps,
			crf: this.config.crf,
			bitrate: this.config.bitrate,
			speed: this.config.speed,
			scale: this.config.scale,
			ffmpegPath: resolveFfmpegPath(this.config.ffmpegPath),
			count: frameFiles.length,
			files: frameFiles
		};

		this.log(`created webm ${this.config.to} from ${frameFiles.length} png frame(s)`);

		return summary;
	}

	validate() {
		ensureValue(this.config.from, 'from');
		ensureValue(this.config.to, 'to');

		if (!fs.existsSync(this.config.from)) {
			throw new Error(`Source path not found: ${this.config.from}`);
		}

		if (!isDirectory(this.config.from)) {
			throw new Error(`"from" must be a directory that contains png frames.`);
		}

		this.config.fps = ensureNumber(this.config.fps, 'fps', {
			min: 0.001
		});
		this.config.crf = ensureNumber(this.config.crf, 'crf', {
			min: 0,
			max: 63
		});
		this.config.speed = ensureNumber(this.config.speed, 'speed', {
			min: 0,
			max: 8,
			integer: true
		});
		this.config.bitrate = normalizeString(this.config.bitrate, '0');
		this.config.scale = normalizeString(this.config.scale, '');
		this.config.ffmpegPath = normalizeString(this.config.ffmpegPath, '');
	}

	detectFrames() {
		const files = collectPngFiles(this.config.from);

		if (files.length === 0) {
			throw new Error(`No png files found in ${this.config.from}`);
		}

		return files;
	}

	buildArgs(pattern) {
		const args = [
			'-y',
			'-hide_banner',
			'-loglevel', 'error',
			'-framerate', String(this.config.fps),
			'-i', pattern
		];

		if (this.config.scale) {
			args.push('-vf', `scale=${this.config.scale}`);
		}

		args.push(
			'-c:v', 'libvpx-vp9',
			'-pix_fmt', 'yuva420p',
			'-auto-alt-ref', '0',
			'-row-mt', '1',
			'-deadline', 'good',
			'-cpu-used', String(this.config.speed),
			'-crf', String(this.config.crf),
			'-b:v', this.config.bitrate,
			'-an',
			this.config.to
		);

		return args;
	}

	log(message) {
		if (this.config.log) {
			console.log(message);
		}
	}
}

module.exports = FramesToWebm;
