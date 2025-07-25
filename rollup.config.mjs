import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import pkg from './package.json' with { type: "json" };
import css from 'rollup-plugin-import-css';

export default [
	// browser-friendly UMD build
	{
		input: ['src/main.js'],
		output: {
			file: pkg.browser,
			format: 'umd',
            name: 'MU',  // so we can call MU.<exported function> from Swift
		},
		plugins: [
			resolve(), 	// so Rollup can find `ms`
			commonjs(), // so Rollup can convert `ms` to an ES module
			css()		// so we can import css
		]
	},

	// CommonJS (for Node) and ES module (for bundlers) build.
	// (We could have three entries in the configuration array
	// instead of two, but it's quicker to generate multiple
	// builds from a single configuration where possible, using
	// an array for the `output` option, where we can specify
	// `file` and `format` for each target)
	{
		input: 'src/main.js',
		external: [
			'ms',
			'crelt',
			'orderedmap',
			'prosemirror-state',
			'prosemirror-view',
			'prosemirror-model',
			'prosemirror-commands',
			'prosemirror-schema-list',
			'prosemirror-tables',
			'prosemirror-inputrules',
			'prosemirror-keymap',
			'prosemirror-history',
			'prosemirror-dropcursor',
			'prosemirror-gapcursor',
			'prosemirror-search',
		],
		output: [
			{ file: pkg.main, format: 'cjs' },
			{ file: pkg.module, format: 'es' }
		]
	}
];
