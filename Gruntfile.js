var projectVersion = require("./package.json").version;
module.exports = function(grunt) {
	grunt.initConfig({
		pkg : grunt.file.readJSON('package.json'),
		jshint: {
			beforeconcat: ['./public/assets/js/*.js', '!./public/assets/js/react-component-*.js', '!./public/assets/js/waveform.js', '!./public/assets/js/github.js']
		},
		clean: {
		 	build: {
				src: ['./studio/*'],
				options: { force: true }
		 	},
		 	bower_components: {
				src: ['./studio/bower_components'],
				options: { force: true }
		 	},

		 	after: {
				src: ['./studio/assets/js/react-component-*.js', './studio/assets/js/app.minified.js', './studio/index.js'],
				options: { force: true }
		 	}
		},
		bump: {
			options: {
				files: ['package.json', 'bower.json'], 
				updateConfigs: [],
				commit: false,
				commitMessage: 'Release v%VERSION%',
				commitFiles: ['package.json', 'bower.json'], // '-a' for all files
				createTag: false,
				tagName: 'v%VERSION%',
				tagMessage: 'Version %VERSION%',
				push: false,
				pushTo: '',
				gitDescribeOptions: '--tags --always --abbrev=1 --dirty=-d' // options to use with '$ git describe'
			}
		}, 
		vulcanize: {
	      default: {
	        options: {
	        	strip:true,
	        	csp:true,
	        },
	        files: {
	          './studio/index.html': './studio/index.html'
	        },
	      },
	    },
		'string-replace': {
			html: {
				options: {
					replacements: [
						{
							pattern: /<!-- SCRIPT START [\s\S]*? SCRIPT END -->/,
							replacement: '<script type="text/javascript" src="assets/js/app.min.js"></script>'
						},
						{
							pattern: /<!-- VERSION START [\s\S]*? VERSION END -->/g,
							replacement: projectVersion
						},
						{
							pattern: /<!-- STYLE START [\s\S]*? STYLE END -->/,
							replacement: '<link rel="stylesheet" type="text/css" href="assets/css/app.min.css">'
						}
					]
				},
				files: [
					{expand: false, flatten: false, src: ['./public/index.html'], dest: './studio/index.html'}
				]
			},
			correction: {
				options: {
					replacements: [
						{
							pattern: '<script charset="utf-8" src="index.js"></script>',
							replacement: ''
						},
						{
							pattern: '<script src="bower_components/polymer/polymer.js">',
							replacement: ''
						}
					]
				},
				files: [
					{expand: false, flatten: false, src: ['./studio/index.html'], dest: './studio/index.html'}
				]
			},
		}, 
		htmlmin: {
			dist: {
			  	options: {
					collapseBooleanAttributes:      true,
					collapseWhitespace:             true, 
					removeComments:                 true, // Only if you don't use comment directives!
					removeEmptyAttributes:          true,
					removeRedundantAttributes:      true,
					removeScriptTypeAttributes:     true,
					removeStyleLinkTypeAttributes:  true
			  	},
		  	 	files: [
			      {expand: true,  src: ['./../boom-build/index.html'], dest: './../boom-build/index.html'},
			      //{expand: true, cwd: './public/templates/', src: ['**/*.html'], dest: './public/templates/'}
			    ]
			}
	  	},
		react: {
			files: {
				expand: true,
				cwd: './public/assets/js/',
				src: ['**/react-component*.js'],
				dest: './studio/assets/js',
				ext: '.js'
			}
		},

		copy: {
			assets: {
				files: [
					{
						expand: true,
						cwd: "./public/assets/images",
						src: ["*.*"],
						dest: "./studio/assets/images",
						flatten: false
					},
				]
			},
			bower_components: {
				files: [
					{
						expand: true,
						cwd: "./public/bower_components",
						src: ["**/*"],
						dest: "./studio/bower_components",
						flatten: false
					}
				]
			}
		},

		uglify: {
			options: {
				beautify: false,
				mangle: true,
				preserveComments: true
			},
			my_target: {
				files: {
					'./studio/assets/js/app.minified.js': [
						"./public/bower_components/octokit/octokit.js",
						"./public/assets/js/waveform.js",
						"./public/assets/js/app.js",
						'./studio/assets/js/react-component-*.js',
						/*"./public/bower_components/webcomponentsjs/webcomponents.js",*/
						//'public-dev/assets/js/*-controller.js',
					]
				}
			}
		},
		cssmin: {
			combine: {
				files: {
					'./studio/assets/css/app.min.css': [
						'./public/assets/css/main.css'
					]
				}
			}
		},
		concat: {
			options: {
			  separator: '\n',
			},
			dist: {
				src: [
					"./public/bower_components/polymer/polymer.min.js",
					"./public/bower_components/react/react-with-addons.min.js",
					//"bower_components/react/JSXTransformer.js",
					"./public/bower_components/jquery/dist/jquery.min.js",
					"./public/bower_components/jquery.cookie/jquery.cookie.js",
					"./public/bower_components/ciseaux/build/ciseaux.min.js",
					'./studio/assets/js/app.minified.js',
					'./studio/index.js',
				],
				dest: './studio/assets/js/app.min.js',
			},
		},
	    mocha_slimer: {
	        default: {
	            options: {
	                ui: 'bdd',
	                reporter: 'Spec',
	                //grep: 'some keyword',
	                // SlimerJS timeout
	                timeout: 1000 * 60 * 15,
	                // set to false and call it later for async tests (AMD etc)
	                run: false,
	                // run SlimerJS via 'xvfb-run': for true headless testing
	                // must be true on Travis-CI, use: (process.env.TRAVIS === 'true')
	                xvfb: (process.env.TRAVIS === 'true'),
	                // pass http urls (use grunt-contrib-connect etc)
	                urls: ["http://localhost:3000/public"]
	            }
		  	}
		}
	});


	// Production Build Tools from package.json
	require('load-grunt-tasks')(grunt);
	
	// Default Production Build task(s).
	grunt.registerTask(
		'default', [
			'jshint',
			'clean:build',
			'bump',
			'string-replace:html',
			'copy:bower_components',
			'vulcanize',
			'react',
			'uglify',
			'concat',
			'copy:assets',
			'cssmin',
			'string-replace:correction',
			'clean:bower_components',
			'clean:after'
			/*
			*/
		]
	);

	grunt.registerTask("build", ['default']);
	grunt.registerTask("test", ['mocha_slimer']);
};