const fs = require('fs');
const path = require('path');
const {convert, frames2webm, inspect, video2webm} = require('./index');

const HELP_TEXT = `
webm-maker

Usage
  webm-maker --from <path> --to <file> [--fps <number>] [--crf <0-63>] [--bitrate <value>] [--speed <0-8>] [--scale <expr>] [--audio-bitrate <value>] [--mute <true|false>] [--ffmpeg-path <path>] [--config <file|->] [--json <true|false>]
  webm-maker frames2webm --from <dir> --to <file> [--fps <number>] [--crf <0-63>] [--bitrate <value>] [--speed <0-8>] [--scale <expr>] [--ffmpeg-path <path>] [--config <file|->] [--json <true|false>]
  webm-maker video2webm --from <file> --to <file> [--crf <0-63>] [--bitrate <value>] [--speed <0-8>] [--scale <expr>] [--audio-bitrate <value>] [--mute <true|false>] [--ffmpeg-path <path>] [--config <file|->] [--json <true|false>]
  webm-maker convert --from <path> --to <file> [--fps <number>] [--crf <0-63>] [--bitrate <value>] [--speed <0-8>] [--scale <expr>] [--audio-bitrate <value>] [--mute <true|false>] [--ffmpeg-path <path>] [--config <file|->] [--json <true|false>]
  webm-maker inspect --from <path> [--ffmpeg-path <path>] [--json <true|false>]

Commands
  convert      Auto-detect the source type and convert to .webm
  frames2webm  Create a .webm file from a directory of png frames
  video2webm   Convert an MP4 video file to .webm
  inspect      Return machine-friendly metadata about the source path

Options
  --from          Source directory or video file
  --to            Output .webm file
  --fps           Frame rate for frames2webm (default: 30)
  --crf           VP9 quality value from 0 to 63 (default: 32)
  --bitrate       Output video bitrate. Use 0 for constant-quality mode
  --speed         ffmpeg cpu-used value from 0 to 8 (default: 1)
  --scale         Optional ffmpeg scale expression such as 1280:-2
  --audio-bitrate Audio bitrate for video2webm (default: 128k)
  --mute          Drop audio from video2webm/convert output. Accepts --mute or --mute true/false
  --ffmpeg-path   Override the ffmpeg binary path for this command only
  --config        JSON config file. Use - to read JSON config from stdin
  --json          Print structured JSON output. Accepts --json or --json true/false
  --help          Show this help

Examples
  webm-maker --from ./frames --to ./output/sequence.webm --fps 24 --json true
  webm-maker frames2webm --from ./frames --to ./output/sequence.webm --fps 24 --crf 30
  webm-maker video2webm --from ./input/video.mp4 --to ./output/video.webm --crf 32 --mute false
  webm-maker inspect --from ./frames --json
  cat config.json | webm-maker convert --config - --json
`.trim();

const COMMAND_ALIASES = {
	frames: 'frames2webm',
	video: 'video2webm',
	auto: 'convert',
	detect: 'inspect',
	probe: 'inspect'
};

async function main(argv = process.argv.slice(2)) {
	try {
		const parsed = parseArgs(argv);

		if (parsed.help) {
			console.log(HELP_TEXT);
			return 0;
		}

		const result = await runCommand(parsed.command, parsed.options);

		if (parsed.options.json) {
			console.log(JSON.stringify({
				ok: true,
				command: parsed.command,
				result
			}, null, 2));
		} else {
			printSummary(parsed.command, result);
		}

		return 0;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const wantsJson = wantsJsonOutput(argv);

		if (wantsJson) {
			console.error(JSON.stringify({
				ok: false,
				error: message
			}, null, 2));
		} else {
			console.error(`Error: ${message}`);
			console.error('');
			console.error(HELP_TEXT);
		}

		return 1;
	}
}

function parseArgs(argv) {
	if (argv.length === 0 || argv.includes('--help')) {
		return {
			help: true,
			command: null,
			options: {}
		};
	}

	const [firstArg, ...restArgs] = argv;
	const rawCommand = firstArg.startsWith('--') ? 'convert' : firstArg;
	const rawOptions = firstArg.startsWith('--') ? argv : restArgs;
	const command = COMMAND_ALIASES[rawCommand] || rawCommand;

	if (!['frames2webm', 'video2webm', 'convert', 'inspect'].includes(command)) {
		throw new Error(`Unknown command: ${rawCommand}`);
	}

	const cliOptions = parseOptions(rawOptions);
	const fileConfig = cliOptions.config ? readConfig(cliOptions.config) : {};

	return {
		help: false,
		command,
		options: {
			...fileConfig,
			...cliOptions
		}
	};
}

function parseOptions(tokens) {
	const options = {};
	const booleanFlags = new Set(['json', 'help', 'mute']);

	for (let index = 0; index < tokens.length; index += 1) {
		const token = tokens[index];

		if (!token.startsWith('--')) {
			throw new Error(`Unexpected argument: ${token}`);
		}

		const key = token.slice(2);

		if (booleanFlags.has(key)) {
			const nextValue = tokens[index + 1];

			if (nextValue !== undefined && !nextValue.startsWith('--')) {
				options[toCamelCase(key)] = parseBoolean(nextValue, key);
				index += 1;
				continue;
			}

			options[toCamelCase(key)] = true;
			continue;
		}

		const value = tokens[index + 1];

		if (value === undefined || value.startsWith('--')) {
			throw new Error(`Missing value for --${key}`);
		}

		options[toCamelCase(key)] = value;
		index += 1;
	}

	return options;
}

function readConfig(configPath) {
	if (configPath === '-') {
		const rawConfig = fs.readFileSync(0, 'utf8');

		try {
			return JSON.parse(rawConfig);
		} catch (error) {
			throw new Error('Invalid JSON config from stdin');
		}
	}

	const absolutePath = path.resolve(configPath);

	if (!fs.existsSync(absolutePath)) {
		throw new Error(`Config file not found: ${configPath}`);
	}

	try {
		return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
	} catch (error) {
		throw new Error(`Invalid JSON config: ${configPath}`);
	}
}

async function runCommand(command, options) {
	switch (command) {
		case 'inspect':
			return inspect(withoutUndefined(options));
		case 'frames2webm':
			return frames2webm(withoutUndefined({
				...options,
				log: false
			}));
		case 'video2webm':
			return video2webm(withoutUndefined({
				...options,
				log: false
			}));
		case 'convert':
			return convert(withoutUndefined({
				...options,
				log: false
			}));
		default:
			throw new Error(`Unsupported command: ${command}`);
	}
}

function printSummary(command, result) {
	switch (command) {
		case 'inspect':
			if (result.convertible) {
				if (result.sourceType === 'frames') {
					console.log(`Detected png frame directory with ${result.frameCount} frame(s)`);
					return;
				}

				console.log(`Detected convertible video ${result.from}`);
				return;
			}

			console.log(`Source is not convertible: ${result.reason}`);
			return;
		case 'frames2webm':
			console.log(`Created webm ${result.to} from ${result.count} png frame(s)`);
			return;
		case 'video2webm':
			console.log(`Converted video ${result.from} => ${result.to}`);
			return;
		case 'convert':
			if (result.command === 'frames2webm') {
				console.log(`Created webm ${result.to} from ${result.count} png frame(s)`);
				return;
			}

			console.log(`Converted video ${result.from} => ${result.to}`);
			return;
		default:
			console.log(JSON.stringify(result, null, 2));
	}
}

function toCamelCase(value) {
	return value.replace(/-([a-z])/g, (_, character) => character.toUpperCase());
}

function parseBoolean(value, key) {
	if (typeof value === 'boolean') {
		return value;
	}

	const normalized = String(value).trim().toLowerCase();

	if (normalized === 'true') {
		return true;
	}

	if (normalized === 'false') {
		return false;
	}

	throw new Error(`"${key}" must be "true" or "false" when a value is provided.`);
}

function wantsJsonOutput(argv) {
	const jsonFlagIndex = argv.indexOf('--json');

	if (jsonFlagIndex === -1) {
		return false;
	}

	const nextValue = argv[jsonFlagIndex + 1];

	if (nextValue !== undefined && !nextValue.startsWith('--')) {
		try {
			return parseBoolean(nextValue, 'json');
		} catch (error) {
			return true;
		}
	}

	return true;
}

function withoutUndefined(value) {
	return Object.fromEntries(
		Object.entries(value).filter(([, entry]) => entry !== undefined)
	);
}

module.exports = {
	HELP_TEXT,
	main,
	parseArgs
};

if (require.main === module) {
	main().then((code) => {
		process.exitCode = code;
	});
}
