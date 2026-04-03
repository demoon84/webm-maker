const fs = require('fs');
const os = require('os');
const path = require('path');

const PNG_EXTENSION = '.png';
const VIDEO_EXTENSIONS = new Set(['.mp4', '.m4v', '.mov']);

function isDirectory(targetPath) {
	return fs.lstatSync(targetPath).isDirectory();
}

function ensureValue(value, fieldName) {
	if (value === undefined || value === null || value === '') {
		throw new Error(`"${fieldName}" is required.`);
	}
}

function ensureNumber(value, fieldName, {min, max, integer = false} = {}) {
	const parsed = Number(value);

	if (!Number.isFinite(parsed)) {
		throw new Error(`"${fieldName}" must be a valid number.`);
	}

	if (integer && !Number.isInteger(parsed)) {
		throw new Error(`"${fieldName}" must be an integer.`);
	}

	if (min !== undefined && parsed < min) {
		throw new Error(`"${fieldName}" must be greater than or equal to ${min}.`);
	}

	if (max !== undefined && parsed > max) {
		throw new Error(`"${fieldName}" must be less than or equal to ${max}.`);
	}

	return parsed;
}

function ensureDirectory(targetPath) {
	fs.mkdirSync(targetPath, {recursive: true});
}

function collectFiles(rootPath, matcher) {
	const result = [];
	const pending = [rootPath];

	while (pending.length > 0) {
		const currentPath = pending.pop();
		const entries = fs.readdirSync(currentPath, {withFileTypes: true});

		entries.forEach((entry) => {
			const absolutePath = path.join(currentPath, entry.name);

			if (entry.isDirectory()) {
				pending.push(absolutePath);
				return;
			}

			if (matcher(absolutePath, entry.name)) {
				result.push(absolutePath);
			}
		});
	}

	return result;
}

function collectPngFiles(rootPath) {
	return collectFiles(rootPath, (absolutePath) => {
		return path.extname(absolutePath).toLowerCase() === PNG_EXTENSION;
	}).sort(naturalCompare);
}

function naturalCompare(left, right) {
	return left.localeCompare(right, undefined, {
		numeric: true,
		sensitivity: 'base'
	});
}

function normalizeString(value, fallback = '') {
	if (value === undefined || value === null || value === '') {
		return fallback;
	}

	return String(value);
}

function isSupportedVideoFile(targetPath) {
	return VIDEO_EXTENSIONS.has(path.extname(targetPath).toLowerCase());
}

function stageFilesAsSequence(files, extension = PNG_EXTENSION) {
	const sequenceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'webm-maker-seq-'));
	const width = Math.max(6, String(files.length).length);

	files.forEach((sourceFile, index) => {
		const targetFile = path.join(
			sequenceRoot,
			`${String(index + 1).padStart(width, '0')}${extension}`
		);

		try {
			fs.linkSync(sourceFile, targetFile);
		} catch (error) {
			fs.copyFileSync(sourceFile, targetFile);
		}
	});

	return {
		directory: sequenceRoot,
		pattern: path.join(sequenceRoot, `%0${width}d${extension}`),
		cleanup: () => {
			fs.rmSync(sequenceRoot, {recursive: true, force: true});
		}
	};
}

module.exports = {
	PNG_EXTENSION,
	VIDEO_EXTENSIONS,
	collectFiles,
	collectPngFiles,
	ensureDirectory,
	ensureNumber,
	ensureValue,
	isDirectory,
	isSupportedVideoFile,
	naturalCompare,
	normalizeString,
	stageFilesAsSequence
};
