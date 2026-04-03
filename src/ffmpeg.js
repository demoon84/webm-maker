const {spawn} = require('child_process');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

function resolveFfmpegPath(customPath) {
	if (customPath) {
		return customPath;
	}

	if (process.env.FFMPEG_PATH) {
		return process.env.FFMPEG_PATH;
	}

	if (ffmpegInstaller && ffmpegInstaller.path) {
		return ffmpegInstaller.path;
	}

	return 'ffmpeg';
}

async function runFfmpeg(args, {ffmpegPath} = {}) {
	const executable = resolveFfmpegPath(ffmpegPath);

	return new Promise((resolve, reject) => {
		const child = spawn(executable, args, {
			stdio: ['ignore', 'ignore', 'pipe']
		});
		let stderr = '';

		child.stderr.on('data', (chunk) => {
			stderr += chunk.toString();
		});

		child.on('error', (error) => {
			reject(new Error(`Failed to start ffmpeg: ${error.message}`));
		});

		child.on('close', (code) => {
			if (code === 0) {
				resolve({code, stderr});
				return;
			}

			const command = [executable, ...args].map(quoteArg).join(' ');
			const details = stderr.trim();

			reject(new Error(
				`ffmpeg exited with code ${code}\nCommand: ${command}${details ? `\n${details}` : ''}`
			));
		});
	});
}

function quoteArg(value) {
	if (/^[a-zA-Z0-9_./:=+-]+$/.test(value)) {
		return value;
	}

	return `"${String(value).replace(/"/g, '\\"')}"`;
}

module.exports = {
	resolveFfmpegPath,
	runFfmpeg
};
