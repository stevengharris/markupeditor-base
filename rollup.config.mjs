import resolve from '@rollup/plugin-node-resolve';

export default [
	{
		input: 'src/main.js',
		output: [
			{ file: "markupeditor.esm.js", format: 'es' }
		],
		plugins: [
			resolve(),
		]
	}
];
