(function($, Waveform, Ciseaux){

	var sampleDbPath = "./../audio/sample-db/";

	var AudioContext = window.AudioContext || window.webkitAudioContext;

	if (!AudioContext){
		alert("Oh NO! Your Browser does not suppert AudioContext!?. We suggest Google Chrome to use this website. Maybe one day your browser will support new web technologies.");
		window.location = "https://www.google.com/chrome/browser/desktop/";
	}
	var onPlayBackIntervalInMilliseconds = 100;


	/* ******************** HELPER FUNCTIONS ************************************************************  */

		$.ajaxTransport("+binary", function(options, originalOptions, jqXHR){
				// check for conditions and support for blob / arraybuffer response type
				if (window.FormData && ((options.dataType && (options.dataType === 'binary')) || (options.data && ((window.ArrayBuffer && options.data instanceof ArrayBuffer) || (window.Blob && options.data instanceof Blob))))){
						return {
								// create new XMLHttpRequest
								send: function(headers, callback){
									// setup all variables
									var xhr = new XMLHttpRequest(),
									url = options.url,
									type = options.type,
									async = options.async || true,
									// blob or arraybuffer. Default is blob
									dataType = options.responseType || "blob",
									data = options.data || null,
									username = options.username || null,
									password = options.password || null;

									xhr.addEventListener('load', function(){
									var data = {};
									data[options.dataType] = xhr.response;
									// make callback and send data
									callback(xhr.status, xhr.statusText, data, xhr.getAllResponseHeaders());
								});

								xhr.open(type, url, async, username, password);

									// setup custom headers
									for (var i in headers ) {
										xhr.setRequestHeader(i, headers[i] );
									}

									xhr.responseType = dataType;
									xhr.send(data);
								},
								abort: function(){
									jqXHR.abort();
								}
						};
				}
		});

		var Speech = function() {
			this.say = function(text, done) {
				if (window.SpeechSynthesisUtterance && window.speechSynthesis){
					var msg = new SpeechSynthesisUtterance();
					//msg.voice = voices[1]; // Note: some voices don't support altering params
					msg.voiceURI = 'native';
					msg.volume = 1; // 0 to 1
					// msg.rate = 0; // 0.1 to 10
					// msg.pitch = 1; //0 to 2
					msg.text = text;
					msg.lang = 'en-US';
					var callbackDone = false;
					msg.onend = function() {
						callbackDone = true;
						console.log("DONE!");
						if (done) {
							done();
						}
					};

					window.speechSynthesis.speak(msg);

					window.setTimeout(function() {
						if (!callbackDone){
							if (done) {
								done();
							}
						}
					},2000);
				} else {
					if (done) {
						done();
					}
				}
			};

			return this;
		};

		function toFixed(value, count) {
			var precision = count || 0,
				power = Math.pow(10, precision),
				absValue = Math.abs(Math.round(value * power)),
				result = (value < 0 ? '-' : '') + String(Math.floor(absValue / power));

				if (precision > 0) {
				var fraction = String(absValue % power), padding = new Array(Math.max(precision - fraction.length, 0) + 1).join('0');
				result += '.' + padding + fraction;
			}
			return result;
		}


	/* ******************** DEVICE ************************************************************  */

		var Device = function(_el) {
			if (_el){
				this._el = _el;
			}
			this.audioContext = new AudioContext();
			this.bufSrc = null;
			//  7  this._chored = false;
			//    this._db = {};
			this._comp = this.audioContext.createDynamicsCompressor();
			this._comp.connect(this.audioContext.destination);
			this._comp.threshold.value = -18;
			this._comp.knee.value = 8;

			this.destination = this._comp;

			this.transportTime = 0;
			this._loadingProgressIndicatorInterval = null;

			this.markers = [];
			this._regions = [];

			var self = this;
			$(window).resize(function() {
				self.onResize();
			});


			return this;
		};

		Device.prototype.addMarker = function(seconds) {
			var sortNumber = function (a,b) {
					return a - b;
			};
			if (seconds){
				seconds = seconds.sort(sortNumber);
				for (var i = 0; i < seconds.length; i++) {
					var second = seconds[i];
					var pos = this.spectrumPosition({seconds : second});
					this.markers.push(pos);
				}
				this.computeSpectrumPositions();
				this.refreshSpectrum();
			}
		};

		Device.prototype.onResize = function() {
			var self = this;
			window.clearTimeout(this.___to);
			this.___to = window.setTimeout(function() {
				self.computeSpectrumPositions();
				self.initializeSpectrum();
			}, 400);
		};

		Device.prototype.$ = function() {
			return $(this._el.getDOMNode());
		};

		Device.prototype.get = function(url, done) {
			var self = this;
			var result = $.ajax({
				url: url,
				type: "GET",
				dataType: "binary",
				responseType : "arraybuffer",
				processData: false,
				success : function( data ){
					if (done){
						$.proxy(done, self)(data);
					}
				}
			});
		};

		Device.prototype.load = function(url, done) {
			var self = this;

			var renderData = function  (audioBuffer) {
				self.tape = new Ciseaux.Tape(audioBuffer);
				self.renderAudio(function() {
					self.setLoadingProgressIndicator(false);
					self.initializeSpectrum();
					if (done){
						$.proxy(done, self)();
					}
				});
			};
			var processData = function  (arraybuffer) {
				self.audioContext.decodeAudioData(arraybuffer, function(decodedData) {
					//self.rawData = decodedData;
					renderData(decodedData);
				});
			};

			if (typeof url === 'string'){
				this.get(url, function(arraybuffer) {
					processData(arraybuffer);
				});
			} else {
				this.renderAudio(function  (audioBuffer) {
					renderData(audioBuffer);
				});
			}
		};

		Device.prototype.setLoadingProgressIndicator = function(activate) {
			if (activate){
				this.$().find("canvas").remove();
				var canvas =  this.$().find(".device-spectrum").get(0);
				var data = [];

				var waveform = new Waveform({
					container: canvas,
					interpolate: false
				});
				var ctx = waveform.context;

				var gradient = ctx.createLinearGradient(0, 0, 0, waveform.height);
				gradient.addColorStop(0.0, "#f60");
				gradient.addColorStop(1.0, "#ff1b00");
				waveform.innerColor = gradient;

				var i=0;
				this._loadingProgressIndicatorInterval = setInterval(function(){
					i++;
					data.push(Math.cos(i / 25) - 0.2 + Math.random()*0.3);
					waveform.update({
						data: data
					});
				}, 1);
			} else {
				this.$().find("canvas").remove();
				window.clearInterval(this._loadingProgressIndicatorInterval);
			}
		};

		Device.prototype.computeSpectrumPositions = function(position) {
			if (this.waveform){
				var durationX = $(this.waveform.container).width();
				for (var i = 0; i < this.markers.length; i++) {
					var marker = this.markers[i];
					if (marker.percent === 0 || marker.percent){
						marker.x = (durationX / 100) * marker.percent;
					} else {
						throw "Need percantage value to compute slice positions in spectrum.";
					}
				}
			}
		};

		Device.prototype.spectrumPosition = function(position) {
			var duration = this.audioBuffer.duration;
			var result = {};

			if (position.x){
				result.x = position.x;
				result.percent = result.x / $(this.waveform.container).width() * 100;
				result.seconds = result.percent / 100 * duration;
			}

			if (position.seconds === 0){
					result.x = 0;
					result.percent = 0;
					result.seconds = 0;
			}

			if (position.seconds){
				var durationX = $(this.waveform.container).width();
				result.percent = position.seconds / duration * 100;
				result.x = (durationX / 100) * result.percent;
				result.seconds = position.seconds;
			}

			return result;
		};

		Device.prototype.refreshSpectrum = function(drawn) {
			if (!this.waveform){
				return;
			}

			if (!drawn){
				this.waveform.redraw();
			}
			this.refreshSpectrumMarkers();

			if (this.spectrumPositionX){
				vLine(this.waveform.context, this.spectrumPositionX, "#f60");
			}
		};

		var vLine = function(context, x, color) {
			context.beginPath();
			context.moveTo(x, 0);
			context.lineTo(x, 190);
			context.strokeStyle = color;
			context.stroke();
		};

		Device.prototype.spectrumCursorPosition = function(x) {
			this.spectrumPositionX = x;
			this.refreshSpectrum();
		};

		Device.prototype.refreshSpectrumMarkers = function() {
			for (var i = 0; i < this.markers.length; i++) {
				var marker = this.markers[i];
				vLine(this.waveform.context, marker.x, "#fff");
				vLine(this.waveform.context, marker.x, "#fff");
			}
		};

		Device.prototype.initializeSpectrum = function() {
			this.$().find("canvas").remove();
			var canvas =  this.$().find(".device-spectrum").get(0);
			if (!canvas) {
				return;
			}
			var data = this.audioBuffer.getChannelData(1);
			this.waveform = new Waveform({
				container: canvas,
				interpolate: true,
				innerColor : function  (i , d) {
					var duration = this.device.audioBuffer.duration;
					var currentTime = (this.device.transportTime / 1000);
					var perc = currentTime/duration;
					//console.log(i,d);
					if (i < perc){
						return "#f60";
					} else {
						return "#676F98";
					}
				}
			});
			this.waveform.device = this;
			this.waveform.update({
				data:data
			});
			var self = this;
			self.refreshSpectrum(true);
		};

		Device.prototype.renderAudio = function(done) {
			var self = this;
			this.tape.render(this.audioContext, 2).then(function(audioBuffer) {
				self.audioBuffer = audioBuffer;
				if (done){
					$.proxy(done, self)(audioBuffer);
				}
			});
		};

		Device.prototype.onPlayBack = function(reset) {
			if (!reset){
				this.transportTime += onPlayBackIntervalInMilliseconds;
			}
			this.refreshSpectrum();
			var time = 0;
			if (this.transportTime > 0){
				time = this.transportTime/1000;
			}
			this._el.setState({currentTime: toFixed(time,1)});
		};

		Device.prototype.play = function(done) {
			this.pause();
			if (this.tape) {
				var self = this;

				self.bufSrc = self.audioContext.createBufferSource();
				self.bufSrc.buffer = self.audioBuffer;
				self.bufSrc.connect(self.destination);
				self.bufSrc.onended = function() {
					window.clearInterval(self.onPlayBackTimerInterval);
					$.proxy(done, self);
				};
				var onPlayBackEventHandler = $.proxy(self.onPlayBack, self);
				self.onPlayBackTimerInterval = window.setInterval(onPlayBackEventHandler, onPlayBackIntervalInMilliseconds);
				onPlayBackEventHandler();
				var offset = 0;
				if (this.transportTime > 0){
					offset = this.transportTime / 1000;
				}
				self.bufSrc.start(0, offset);
			}
		};

		Device.prototype.stop = function() {
			var self = this;
			self.pause();
			self.transportTime = 0;
			self.onPlayBack(true);
		};

		Device.prototype.pause = function() {
			if (this.tape && this.bufSrc) {
				window.clearInterval(this.onPlayBackTimerInterval);
				this.bufSrc.stop();
			}
		};

		Device.prototype.open = function(url, done) {
			var self = this;
			if (!self._el){
				self.render(function() {
					self._el = this;
					self.setLoadingProgressIndicator(true);
					self.load(url, function() {
						if (done){
							$.proxy(done, self)(self);
						}
						self.chopSlices();
					});

				});
			} else {
				self.load(url, function() {
					if (done){
						$.proxy(done, self)(self);
					}
					self.chopSlices();
				});
				self.setLoadingProgressIndicator(true);
			}
		};

		Device.prototype.slice = function(id) {
			return this.slices(id);
		};

		Device.prototype.chopSlices = function() {
			var sortNumber = function (a,b) {
					return a.seconds - b.seconds;
			};

			var self = this;
			this.markers = this.markers.sort(sortNumber);
			this.slices = [];
			for (var i = 0; i < this.markers.length-1; i++) {
				var start = this.markers[i].seconds;
				var length = this.markers[i+1].seconds - this.markers[i].seconds;
				var tape = this.tape.slice(start, length);
				this.slices.push(new Slice(tape));
			}
		};

		Device.prototype.config = function() {
			var self = this;
			var slices = function() {
				var result = [];
				for (var i = 0; i < self.markers.length; i++) {
					result.push(self.markers[i].seconds);
				}
				return result;
			};

			var patterns = function() {
				var result = [];
				for (var i = 0; i < self.patterns.length; i++) {
					var pattern = self.patterns[i];
					result.push({
						id : pattern.id,
						bars : pattern.bars,
						sequence : pattern.sequence
					});
				}
				return result;
			};

			return {
				sample : this.filename,
				slices : slices(),
				patterns : patterns()
			}
		};

	/* ******************** PROJECT ************************************************************  */

		var Project = function(parentElement) {
			this.parentElement = parentElement;
			return this;
		};

		Project.prototype.$ = function() {
			return $(this._el.getDOMNode());
		};

		Project.prototype.newDevice = function(deviceConfig, done) {
			var self = this;
			var device = new Device();
			var childDevices = self._el.state.devices;
			var onComplete = function  () {
					device.addMarker(deviceConfig.slices);
					device.chopSlices();
					if (done){
						$.proxy(done, self)(device);
					}
			};
			device.project = self;
			childDevices.push(device);
			self._el.setState({devices:childDevices});// render device;

			if (deviceConfig.sample){
				var shortName = deviceConfig.sample.split("/");
				if (shortName.length > 1){
					shortName.shift();
				}
				shortName = shortName.join("//");
				device.name = shortName;
				device.filename = deviceConfig.sample;
				device._el.setState({name : shortName});
				device.open(sampleDbPath + deviceConfig.sample,  onComplete);
			}


			device.patterns = [];
			for (var p = 0; p < deviceConfig.patterns.length; p++) {
				device.patterns.push(new Pattern(device, deviceConfig.patterns[p]));
			}

			if (deviceConfig.tape){
				device.tape = deviceConfig.tape;
				device.load(null, onComplete);
			}
		};

		Project.prototype.deviceContainer = function(index) {
			return this.$().find(".project-device-container-" + index).get(0);
		};

		Project.prototype.renderGUI = function(done) {
			var self = this;
			self.render(function() {
				self._el = this;
				if (done){
					$.proxy(done, self)();
				}
			});
		};

		Project.prototype.open = function(projectConfig, done) {
			var self = this;
			if (!self.all){
				self.all = projectConfig.devices.length;
			}
			self._el.setState({bpm : projectConfig.bpm, name : projectConfig.name});
			var onOpened = function() {
						self.all--;
						if (self.all === 0){
							self.all = null;
							done(projectConfig);
						}
			};

			for (var i = 0; i < projectConfig.devices.length; i++) {
				self.newDevice(projectConfig.devices[i], onOpened);
			}
		};

		Project.prototype.config = function() {
			var result = {
				name : this.name,
				bpm : this.bpm,
				devices : []
			};

			for (var i = 0; i < this._el.state.devices.length; i++) {
				result.devices.push(this._el.state.devices[i].config());
			}

			return result;
		};

		Project.prototype.configString = function() {
			return JSON.stringify(this.config(), "\t", 1);
		};

	/* ******************** SEQUENCER ************************************************************  */

		var Sequencer = function() {
			return this;
		};

		Sequencer.prototype.$ = function() {
			return $(this._el.getDOMNode());
		};

		Sequencer.prototype.renderGUI = function(done) {
			var self = this;
			self.render(function() {
				self._el = this;
				if (done){
					$.proxy(done, self)();
				}
			});
		};

	/* ******************** PATTERN-EDITOR ************************************************************  */

		var PatternEditor = function() {
			return this;
		};

		PatternEditor.prototype.$ = function() {
			return $(this._el.getDOMNode());
		};

		PatternEditor.prototype.renderGUI = function(done) {
			var self = this;
			self.render(function() {
				self._el = this;
				if (done){
					$.proxy(done, self)();
				}
			});
		};

		PatternEditor.prototype.open = function(device) {
			this._el.setState({connectedDevice: device, connectedDeviceName: device.name});
		};

	/* ******************** STUDIO ************************************************************  */

		var Studio = function() {
			return this;
		};

		Project.prototype.$ = function() {
			return $(this._el.getDOMNode());
		};

		Studio.prototype.Speech = Speech;

		Studio.prototype.Project = Project;

		Studio.prototype.renderGUI = function(parentElement, done) {
			var self = this;

			self.project = new self.Project(parentElement);
			self.project.studio = self;
			self.project.renderGUI(function() {
					self.patternEditor = new PatternEditor();
					self.patternEditor.renderGUI(function(){
						$('#gui').fadeIn("slow", function(){
							done();
						});
					});
			});
		};

		Studio.prototype.init = function(initialProjectConfig, done) {
			var self = this;
			var say = new this.Speech().say;

			$('#gui-loading-progress').fadeIn("fast", function() {});
			//$(function() {
			$("body").one("react-components-ready", function() {
					//say("loading project", function() {
						self.renderGUI(document.getElementById('content'), function() {
							if (initialProjectConfig){
								self.project.bpm = initialProjectConfig.bpm;
								self.project.name = initialProjectConfig.name;
								self.project.open(initialProjectConfig, function(projectConfig) {
									//say("the song \"" + projectConfig.name+ "\" is ready on " + projectConfig.bpm + " beats per minute!");
									if (done){
										$.proxy(done, self)(initialProjectConfig);
									}
								});
							} else {
								if (done){
									$.proxy(done, self)(initialProjectConfig);
								}
							}
						});
					//});
			});
			//});
		};

	/* ******************** SLICE ************************************************************  */
		var daAudioContext = new AudioContext();
		var Slice = function(tape) {
			var count = 1;
			var g = 1;
			tape = Ciseaux.concat(tape.split(1000).map(function(tape, i) {
				var vol = 0.1;
				if (i > 990){
					g -= vol;
				}
				return tape.gain(g);
			}));
			this.tape = tape;

			this.audioContext = daAudioContext;
			this.bufSrc = null;
			//  7  this._chored = false;
			//    this._db = {};
			this._comp = this.audioContext.createDynamicsCompressor();
			this._comp.connect(this.audioContext.destination);
			this._comp.threshold.value = -18;
			this._comp.knee.value = 8;

			this.destination = this._comp;

			return this;
		};

		Slice.prototype.play = function(done) {
			if (this.tape) {
				var self = this;
				this.tape.render(this.audioContext, 2).then(function(audioBuffer) {
					self.audioBuffer = audioBuffer;
					self.bufSrc = self.audioContext.createBufferSource();
					self.bufSrc.buffer = self.audioBuffer;
					self.bufSrc.connect(self.destination);
					self.bufSrc.onended = function() {
						if (done){
							$.proxy(done, self);
						}
					};
					self.bufSrc.start(0, 0);
				});
			}
		};

	/* ******************** PATTERN ************************************************************  */

		var Pattern = function(device, patternConfig) {
			this.device = device;
			this.id = patternConfig.id;
			this.bars = patternConfig.bars;
			this.sequence = patternConfig.sequence;
			this.patternConfig = patternConfig;
			this.audioContext = daAudioContext;
			this.bufSrc = null;
			//  7  this._chored = false;
			//    this._db = {};
			this._comp = this.audioContext.createDynamicsCompressor();
			this._comp.connect(this.audioContext.destination);
			this._comp.threshold.value = -18;
			this._comp.knee.value = 8;

			this.destination = this._comp;

			return this;
		};

		Pattern.prototype.toString = function(sliceIndex) {
			var sequence = this.sequence;
			//var slice = this.device.slices[sliceIndex];
			var result = "";
			for (var i = 0; i < sequence.length; i++) {
				var subSequence = sequence[i];
				if (subSequence.indexOf(sliceIndex) === -1){
					result += " ";
				} else {
					result += "a";
				}
			}
			return result;
		};

		Pattern.prototype.renderSequence = function(done) {
			var self = this;
			// 60 000 / 96 BPM = 625 ms

			var bpm = this.device.project.bpm;
			var numerOfBars = 1;
			var durationPerStep = ((60000 / bpm ) / 1000) / (numerOfBars*2);
			var tracks = [];

			var tape;

			for (var i = 0; i < this.device.slices.length; i++) {
				var sliceTape = this.device.slices[i].tape;
				var tape1 = new Ciseaux.Sequence(this.toString(i+1), durationPerStep, {
					a: sliceTape
				}).apply();
				if (tape){
					tape = tape.mix(tape1);
				} else {
					tape = tape1;
				}
			}

			this.tape = tape;
			done(tape);
		};

		Pattern.prototype.play = function(done) {
			var self = this;
			self.renderSequence(function(tape) {
				self.tape.render(self.audioContext, 2).then(function(audioBuffer) {
					self.audioBuffer = audioBuffer;
					self.bufSrc = self.audioContext.createBufferSource();
					self.bufSrc.buffer = self.audioBuffer;
					self.bufSrc.connect(self.destination);
					self.bufSrc.onended = function() {
							$.proxy(done, self);
					};
					self.bufSrc.loop = true;
					self.bufSrc.start(0, 0);
				});
			});
		};

		Pattern.prototype.stop = function() {
			var self = this;
			self.pause();
			self.transportTime = 0;
		};

		Pattern.prototype.pause = function() {
			if (this.tape && this.bufSrc) {
				this.bufSrc.stop();
			}
		};

	/* ******************** USER ************************************************************  */

		var User = function() {
			this.mainRepoName = "beatproducer-projects";
			return this;
		};

		User.prototype.login = function(username, password, done) {
			this.github = new window.Octokit({
				username: username,
				password: password,
				auth: "basic"
			});
			user.initialzeRepo(done);
		};

		User.prototype.forkRepo = function(done) {
			var self = this;

			this.fork = this.github.getRepo(username, self.mainRepoName);
			this.repo = this.github.getRepo("s-a", self.mainRepoName);
			this.username = username;
			
			var onRejected = function(argument,b) {
				self.repo.fork().then(function() {
					window.setTimeout(function() { // give the fork some time
						self.fork = self.github.getRepo(username, self.mainRepoName);
						if (done){
							done();
						}
					},5000);
				}, function() {
					alert("error while fork.");
				});
			};
			this.fork.getInfo().then(done, onRejected);
		};

		User.prototype.initialzeRepo = function(done) {
			this.forkRepo(done);
		};

		User.prototype.newSong = function(songname, done) {
			var self = this;
			self.branchname = songname;
			self.branch = self.fork.getBranch("master");
			self.branch.createBranch(songname).then(function() {
				self.branch = self.fork.getBranch(songname);
				done();
			}, function() {
				self.branch = self.fork.getBranch(songname);
				done();
			});
		};

		User.prototype.saveSong = function(data, commitMessage, done) {
			var filename = "projects/" + this.username + '_' + this.branchname + ".json";
			user.branch.write(filename, JSON.stringify(data), commitMessage, false).then(function(err) {
				if (done){ done(); }
			});
		};

		User.prototype.publish = function(done) {
				var pull = {
					title: "I' d like to publish my new song. XD - " + new Date().getTime(),
					body:  "This pull request has been automatically generated by beatproducer-GUI.",
					base:  "master",
					head:  this.username + ":" + this.branch
				};

				this.repo.createPullRequest(pull, function(err, pullRequest) {
					if (err){
						if (err.error === 422){
							if (done){ done(); }
						} else {
							alert("error creating pull request;\n" + err.request.responseText);
							console.log(err);
						}
					} else {
						if (done){ done(); }
					}
				});
		};

	/* ******************** PUBLIC ************************************************************  */

		if (!window.boom){
			window.boom = {
				Studio : Studio,
				Speech : Speech,
				Device : Device,
				Slice : Slice,
				Project : Project,
				PatternEditor : PatternEditor,
				User : User
			};
		}


})(jQuery, window.Waveform, window.Ciseaux);


var studio = new window.boom.Studio();

var bpm = document.querySelector('#bpm');
bpm.addEventListener('core-change', function() {
	if (studio.project){
		studio.project.bpm = bpm.value;
	}
});



var projectConfig = {
	bpm : 080,
	name : "The dawn of a souled hip hop rhythm.",
	devices: [
		{
			sample : "beatproducer-drum-loops-pack-1/bpnet_european_hip_hop_beat_090bpm.wav",
			slices : [0,0.67, 10.67, 1 /*,2,3,5,4,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21*/],
			patterns : [
				{
					id: 1,
					bars: 1,
					sequence : [[1],[1],[2],[], [1],[1],[2],[]]
				},
				{
					id: 2,
					bars: 2,
					steps : 16,
					sequence : [[2,1], [], [2,1], [], [2,1], [], [2,1], [], [2,1], [], [2,1], [], [2,1], [], [2,1], []]
				}
			]
		}
	]
};


studio.init(projectConfig, function(config) {

	document.title = this.project.name;
	bpm.value = this.project.bpm;


	$('#gui-loading-progress').fadeOut("fast", function() {
		var username = "";
		var password = "";
		var user = new window.boom.User();

		user.login(username, password, function(){
			user.newSong("test", function() {
				var msg = 'changed the song ' + new Date().getTime().toString();
				var data = {foo: "bar2222", test: new Date().getTime().toString()};
				user.saveSong(data, msg, function() {
					// user.publish(function() { console.log("done"); });
				});
			});
		});
	});

});

window.addEventListener('polymer-ready', function (e) {
 document.getElementById("gui").responsiveWidth = "1920px";
});
