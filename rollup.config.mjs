import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import css from 'rollup-plugin-import-css';
import json from '@rollup/plugin-json'

export default [
	// browser-friendly UMD build, used in Swift WKWebView :-(
	//{
	//	input: ['src/main.js'],
	//	output: {
	//		file: "dist/markup-editor.umd.js",
	//		format: 'umd',
    //        name: 'MU',  // so we can call MU.<exported function> from Swift
	//	},
	//	plugins: [
	//		resolve(), 	// so Rollup can find `ms`
	//		css()		// so we can import css
	//	]
	//},
	{
		input: 'src/main.js',
		output: [
			{ file: "dist/markup-editor.js", format: 'es' }
		],
		plugins: [
			resolve(),
			commonjs(),		// so we can import highlight.js/lib/core (real CJS under its ESM entry)
			css(),			// so we can import css
			json()			// so we can import json
		]
	}
];
