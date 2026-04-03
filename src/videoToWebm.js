const fs = require('fs');
const path = require('path');
const {
	ensureDirectory,
	ensureNumber,
	ensureValue,
	isDirectory,
	isSupportedVideoFile,
	normalizeString
} = require('./util');
const {resolveFfmpegPath, runFfmpeg} = require('./ffmpeg');

class VideoToWebm {
	constructor(config = {}) {
		this.config = {
			from: '',
			to: '',
			crf: 32,
			bitrate: '0',
			speed: 1,
			scale: '',
			audioBitrate: '128k',
			mute: false,
			ffmpegPath: '',
			log: true,
			...config
		};
	}

	async run() {
		this.validate();

		ensureDirectory(path.dirname(this.config.to));
		await runFfmpeg(this.buildArgs(), {
			ffmpegPath: this.config.ffmpegPath
		});

		const summary = {
			command: 'video2webm',
			sourceType: 'video',
			from: this.config.from,
			to: this.config.to,
			crf: this.config.crf,
			bitrate: this.config.bitrate,
			speed: this.config.speed,
			scale: this.config.scale,
			audioBitrate: this.config.audioBitrate,
			mute: this.config.mute,
			ffmpegPath: resolveFfmpegPath(this.config.ffmpegPath)
		};

		this.log(`converted video ${this.config.from} => ${this.config.to}`);

		return summary;
	}

	validate() {
		ensureValue(this.config.from, 'from');
		ensureValue(this.config.to, 'to');

		if (!fs.existsSync(this.config.from)) {
			throw new Error(`Source path not found: ${this.config.from}`);
		}

		if (isDirectory(this.config.from)) {
			throw new Error(`"from" must be a video file.`);
		}

		if (!isSupportedVideoFile(this.config.from)) {
			throw new Error(`Unsupported source video: ${this.config.from}`);
		}

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
		this.config.audioBitrate = normalizeString(this.config.audioBitrate, '128k');
		this.config.mute = Boolean(this.config.mute);
		this.config.ffmpegPath = normalizeString(this.config.ffmpegPath, '');
	}

	buildArgs() {
		const args = [
			'-y',
			'-hide_banner',
			'-loglevel', 'error',
			'-i', this.config.from,
			'-map', '0:v:0'
		];

		if (!this.config.mute) {
			args.push('-map', '0:a?');
		}

		if (this.config.scale) {
			args.push('-vf', `scale=${this.config.scale}`);
		}

		args.push(
			'-c:v', 'libvpx-vp9',
			'-pix_fmt', 'yuv420p',
			'-row-mt', '1',
			'-deadline', 'good',
			'-cpu-used', String(this.config.speed),
			'-crf', String(this.config.crf),
			'-b:v', this.config.bitrate
		);

		if (this.config.mute) {
			args.push('-an');
		} else {
			args.push('-c:a', 'libopus', '-b:a', this.config.audioBitrate);
		}

		args.push(this.config.to);

		return args;
	}

	log(message) {
		if (this.config.log) {
			console.log(message);
		}
	}
}

module.exports = VideoToWebm;
