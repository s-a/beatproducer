(function($, Waveform, Ciseaux){

	var sampleDbPath = "./../audio/sample-db/";

	var AudioContext = window.AudioContext || window.webkitAudioContext;
	var daAudioContext;
	if (!AudioContext){
		this.alert("Oh NO! Your Browser does not suppert AudioContext!?. Take a look at supported browser list to use this website. Maybe one day your browser will support new web technologies. o.O");
		window.location = "https://github.com/s-a/beatproducer#browser-support";
	} else {
		daAudioContext = new AudioContext();
	}
	var uniqueId = 0;

	var onPlayBackIntervalInMilliseconds = 100;





	/* ******************** HELPER FUNCTIONS ************************************************************  */
		var id = function function_name (argument) {
			uniqueId++;
			return uniqueId;
		}

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

	/* ******************** FX controller ************************************************************  */
		var EffectController = function  (device) {
			this.device = device;
			this.effects = [];
			this.computedEffects = [];

			this.add({
				id : "MAINSIGNAL",
				type : "Compressor",
				//connectTo : "MAIN",
				config : {
					threshold: -18, 
					knee: 8
				}
			});

			return this;
		}

		EffectController.prototype.add = function(fxConfig) {
			this.effects.push(fxConfig);
		};

		EffectController.prototype.Effect = function(device, settings) {
			this.device = device;

		  	var source = null;
		  	if (settings.source){
		  		for (var i = 0; i < this.device.effectController.effects.length; i++) {
		  			var fx = this.device.effectController.effects[i];
		  			if (fx.id === settings.source) {// eg main signal
		  				source = this.device.effectController.computedEffects[i].output; // _comp
		  				break;
		  			}
		  		}
		  		if (!source){
		  			throw "Source Effect Device "  + settings.source + " not found";
		  		}
		  	}


			var ctx = this.device.audioContext;
			if (!window.sa.webAudioFX[settings.type]){
				throw "Effect " + settings.type + " not found!";
			}
			this.effect = new window.sa.webAudioFX[settings.type](ctx, this.device.audioContext.destination, settings.config);
			if (source){
				source.connect(this.effect.output);
			}

			if (settings.id === "MAINSIGNAL"){
				this.device.destination = this.effect.output; // compressor.output;
			}
			return this.effect;
		};

		EffectController.prototype.apply = function() {

			this.computedEffects = [];

			for (var i = 0; i < this.effects.length; i++) {
				var effectConfig = this.effects[i];
				var effect = new this.Effect(this.device, effectConfig);
				this.computedEffects.push(effect);
			}

			
			// MAIN device.audioContext.destination


		};

	/* ******************** DEVICE ************************************************************  */

		var Device = function(_el) {
			if (_el){
				this._el = _el;
			} 
			this.effectController = new EffectController(this);
			this._id = id();
			this.audioContext = daAudioContext;
			this.bufSrc = null;
			//  7  this._chored = false;
			//    this._db = {};
			 
								/*  	
				    var delay = ctx.createDelay();
				    delay.delayTime.value = 0.5;

				    var feedback = ctx.createGain();
				    feedback.gain.value = 0.8;

				    var filter = ctx.createBiquadFilter();
				    filter.frequency.value = 1000;

				    delay.connect(feedback);
				    feedback.connect(filter);
				    filter.connect(delay);

				    source.connect(delay);
				    source.connect(ctx.destination);
				    delay.connect(ctx.destination);
				*/			
			//this.destination = source;
			

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
			var result = null;
			if (this._el){
				try{
					result = $(this._el.getDOMNode());
				} catch(e){
					result = $([]);
				}
			} else {
				result = $([]);
			}
			return result;
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
				self._el.setState({name : self.name});
				self.audioContext.decodeAudioData(arraybuffer, function(decodedData) {
					//self.rawData = decodedData;
					renderData(decodedData);
				});
			};

			if (typeof url === 'string'){
				if (!this.name){
					this.name = url.split("/").pop();
				}
				if (!this.filename){
					this.filename = url.replace(sampleDbPath, "");
				}
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
			if (!this.audioBuffer){
				return null;
			}
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
			if (!canvas || !this.audioBuffer) {
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
			
						this.effectController.add({
							id : "myDistortionEffect",
							type : "Distortion",
							source : "MAINSIGNAL",
							//connectTo : "MAIN",
							config : {
								curve: 80, 
								oversample: 4
							}
						});

			 

			this.pause();
			if (this.tape) {
				var self = this;

				this.effectController.apply();

				self.bufSrc = self.audioContext.createBufferSource();
				self.bufSrc.buffer = self.audioBuffer;
				self.bufSrc.connect(self.destination);
				self.bufSrc.onended = function() {
					window.clearInterval(self.onPlayBackTimerInterval);
					if (done){
						$.proxy(done, self)();
					}
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
				if (!self.parentElement){
					self.parentElement = self.project._el.getDOMNode();
				}
				self.render(function() {
					self._el = this;
					self.setLoadingProgressIndicator(true);
					self.load(url, function() {
						self.chopSlices();
						if (done){
							$.proxy(done, self)(self);
						}
					});

				});
			} else {
				self.load(url, function() {
					self.chopSlices();
					if (done){
						$.proxy(done, self)(self);
					}
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
				this.slices.push(new Slice(self, tape));
			}
		};

		Device.prototype.config = function() {
			var self = this;
			var slices = function() {
				var result = [];
				if (self.markers){
					for (var i = 0; i < self.markers.length; i++) {
						result.push(self.markers[i].seconds);
					}
				}
				return result;
			};

			var patterns = function() {
				var result = [];
				if (self.patterns){
					for (var i = 0; i < self.patterns.length; i++) {
						var pattern = self.patterns[i];
						result.push({
							id : pattern.id,
							bars : pattern.bars,
							sequence : pattern.sequence
						});
					}
				}
				return result;
			};

			return {
				name : self.name,
				sample : this.filename,
				slices : slices(),
				patterns : patterns()
			};
		};

	/* ******************** PROJECT ************************************************************  */

		var Project = function(parentElement) {
			this.parentElement = parentElement;
			return this;
		};

		Project.prototype.$ = function() {
			return $(this._el.getDOMNode());
		};

		Project.prototype.reset = function() {
			this._el.setState({devices:[]});// render device;
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
			self._el.setState({devices:childDevices}, function() {

				if (deviceConfig.sample){
					device.name = deviceConfig.name;
					if (!device.name){
						var shortName = deviceConfig.sample.split("/");
						if (shortName.length > 1){
							shortName.shift();
						}
						shortName = shortName.join("//");
						device.name = shortName;
					}
					device.filename = deviceConfig.sample;
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
			});// render device;

		};

		Project.prototype.deviceContainer = function(index) {
			return this.$().find(".project-device-container-" + index).get(0);
		};

		Project.prototype.renderGUI = function(done) {
			var self = this;
			if (self.render){
				self.render(function() {
					self._el = this;
					if (done){
						$.proxy(done, self)();
					}
				});
			} else {
				done();
			}
		};

		Project.prototype.open = function(projectConfig, done) {
			var self = this;
			if (!projectConfig || !projectConfig.devices){
				done();
				return;
			}
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

			if (!projectConfig.devices || projectConfig.devices.length === 0) {done();}
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
				var sampler = this._el.state.devices[i].config();
				if (sampler.sample){
					result.devices.push(sampler);
				}
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
			if (self.render){
				self.render(function() {
					self._el = this;
					if (done){
						$.proxy(done, self)();
					}
				});
			} else {
				done();
			}
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
					//$('#gui').fadeIn("slow", function(){
						done();
					//});
				});
			});
		};


		Studio.prototype.reset = function(initialProjectConfig, done) {
			if (this.project){
				this.project.reset();
			}
		};

		Studio.prototype.init = function(initialProjectConfig, done) {
			var self = this;
			self.reset();
			var say = new this.Speech().say;

			if (initialProjectConfig){
				document.title = initialProjectConfig.name;
			}

			if (initialProjectConfig && self.gui.bpmSlider){
				self.gui.bpmSlider.value = initialProjectConfig.bpm;
			}

			$('#gui-loading-progress').fadeIn("fast", function() {});
			//$(function() {
			//			$("body").one("react-components-ready", function() {
				if (initialProjectConfig){
					self.gui.alert("loading project");
				}
				self.renderGUI(document.getElementById('content'), function() {
					if (initialProjectConfig){
						self.project.bpm = initialProjectConfig.bpm;
						self.project.name = initialProjectConfig.name;
						self.project.open(initialProjectConfig, function(projectConfig) {
							$('#gui-loading-progress').fadeOut("fast", function() {
								if (projectConfig){
									self.gui.alert("&#8220;" + projectConfig.name+ "&#8221; is ready with " + projectConfig.bpm + " beats per minute!");
								}
								if (done){
									$.proxy(done, self)(initialProjectConfig);
								}
							});
						});
					} else {
						$('#gui-loading-progress').fadeOut("fast", function() {
							if (done){
								$.proxy(done, self)(initialProjectConfig);
							}
						});
					}
				});
			//			});
		};

	/* ******************** SLICE ************************************************************  */

		var Slice = function(device, tape) {
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
			this.device = device;
			this.effectController = new EffectController(this);

			return this;
		};

		Slice.prototype.play = function(done) {
			this.effectController.effects = [];

			for (var i = 0; i < this.device.effectController.effects.length; i++) {
				var fx = this.device.effectController.effects[i];
				this.effectController.add(fx);
			}

			if (this.tape) {
				var self = this;
				this.tape.render(this.audioContext, 2).then(function(audioBuffer) {
					self.audioBuffer = audioBuffer;
					self.effectController.apply();
					self.bufSrc = self.audioContext.createBufferSource();
					self.bufSrc.buffer = self.audioBuffer;
					self.bufSrc.connect(self.destination);
					self.bufSrc.onended = function() {
						if (done){
							$.proxy(done, self)();
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
			this.effectController = new EffectController(this);

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

			this.effectController.effects = [];
			for (var i = 0; i < this.device.effectController.effects.length; i++) {
				var fx = this.device.effectController.effects[i];
				this.effectController.add(fx);
			}

			var self = this;
			self.renderSequence(function(tape) {
				self.tape.render(self.audioContext, 2).then(function(audioBuffer) {
					self.audioBuffer = audioBuffer;
					self.effectController.apply();
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
			this.username = username;
			this.initialzeRepo(done);
		};

		User.prototype.forkRepo = function(done) {
			var self = this;

			this.fork = this.github.getRepo(this.username, self.mainRepoName);
			this.repo = this.github.getRepo("s-a", self.mainRepoName);

			var onRejected = function(res) {
				if (res.status === 401){
					self.onError(res);
				} else {
					self.repo.fork().then(function() {
						window.setTimeout(function() { // give the fork some time
							self.fork = self.github.getRepo(self.username, self.mainRepoName);
							if (done){
								done();
							}
						},5000);
					}, self.onError);
				}
			};
			this.fork.getInfo().then(done, onRejected);
		};

		User.prototype.initialzeRepo = function(done) {
			this.forkRepo(done);
		};

		User.prototype.newSong = function(songname, done) {
			var self = this;
			$('#gui-loading-progress').fadeIn("fast", function() {
				self.branchname = songname;
				self.branch = self.fork.getBranch("master");

				self.branch.createBranch(songname).then(function() {
					self.branch = self.fork.getBranch(songname);
					done();
				}, self.onError);
			});
		};

		User.prototype.saveSong = function(data, commitMessage, done) {
			var self = this;
			var filename = "projects/" + this.username + " " + this.branchname + ".json";
			this.branch.write(filename, data, commitMessage, false).then(function() {
				window.gui.user = self;
				if (done){
					done();
				}
			}, this.onError);
		};

		User.prototype.onError = function(a) {
			var res = JSON.parse(a.message).errors;
			if (!res){
				res = JSON.parse(a.message);
				res.resource = "";
			} else {
				res = res[res.length-1];
			}
			var msg = res.resource + "\n\n" + res.message;
			$('#gui-loading-progress').fadeOut("fast", function() {
				if (a.status === 401){
					window.gui.onLoginClick();
				}
				window.gui.alert(msg);
			});
		};

		User.prototype.publish = function(done) {
			var self = this;
			var pull = {
				title: "I' d like to publish my new song. Yo!",
				body:  "This pull request has been automatically generated by the beatproducer-GUI.",
				base:  "master",
				head:  this.username + ":" + this.branchname
			};
			$('#gui-loading-progress').fadeIn("fast", function() {
				self.repo.createPullRequest(pull).then(done, self.onError);
			});
		};

	/* ******************** GUI ************************************************************  */
		var GUI = function  (studio) {
			if (!AudioContext){
				this.alert("Oh NO! Your Browser does not suppert AudioContext!?. Take a look at supported browser list to use this website. Maybe one day your browser will support new web technologies. o.O");
				window.location = "https://github.com/s-a/beatproducer#browser-support";
			} else {
				this.studio = studio;
				this.credentials = {
					uid : $.cookie("uid"),
					pwd : $.cookie("pwd")
				};
				$(".input-login-uid:first").val(this.credentials.uid);
				$(".input-login-pwd:first").val(this.credentials.pwd);

				this.initEventListeners();
			}


			return this;
		};

		GUI.prototype.alert = function(msg) {
			var toast = $('<paper-toast duration="5000" text="' + msg + '"></paper-toast>');
			$('body').append(toast);
			toast.get(0).addEventListener("core-overlay-close-completed", function() {
				toast.remove();
			});
			if (toast.get(0).show){
				toast.get(0).show();
			}
		};

		GUI.prototype.onLoginClick = function(el) {
			document.querySelector('#login-dialog').toggle();
		};

		GUI.prototype.onOpenProjectClick = function(el) {
			var self = window.gui;


			if (!self.user){
				if (!window.gui.credentials.uid || !window.gui.credentials.pwd){
					new User().onError({"status":401, "message":'{"errors":[{"resource": "New Project","message":"No user login"}]}'});
					return;
				}
			}

			var mapDirectoryContents = function  (contents) {
				var projects = JSON.parse(contents);
				var map = [];
				for (var i = 0; i < projects.length; i++) {
					var project = projects[i];
					var tmp = project.name.split(" ");
					var name = tmp.pop().split(".json")[0];
					var user = tmp.join(" ");
					map.push({"user":user, "name": name});
				}
				return map;
			};

			var fetchDirectoryContents = function(user, done) {
				var repo = user.github.getRepo("s-a", "beatproducer-projects");
				var branch = repo.getBranch("master");

				branch.contents('projects').then(done, user.onError);
			};

			$('#gui-loading-progress').fadeIn("fast", function() {});

			var user = new window.boom.User();
			user.login(window.gui.credentials.uid, window.gui.credentials.pwd, function(){
				
				fetchDirectoryContents(user, function(contents) {
					var projects = mapDirectoryContents(contents);
					var pub = document.getElementById('public-project-list');
					pub.model = {
						projects: projects
					};
					var repo2 = user.github.getRepo(window.gui.credentials.uid, "beatproducer-projects");
					repo2.getBranches().then(function(branches) {
						var privateSongs = [];
						for (var i = 0; i < branches.length; i++) {
							var branch = branches[i].pop();
							if (branch !== "master"){
								privateSongs.push({name:branch, user:window.gui.credentials.uid});
							}
						}
						var priv = document.getElementById('private-project-list');
						priv.model = {
							projects: privateSongs
						};

						$('#gui-loading-progress').fadeOut("fast", function() {
							document.querySelector('#project-open-dialog').toggle();
						});
					});
				});
			});

		};

		GUI.prototype.onSaveProjectClick = function(el) {
			if (!window.gui.credentials.uid || !window.gui.credentials.pwd){
				new User().onError({"status":401, "message":'{"errors":[{"resource": "New Project","message":"No user login"}]}'});
				return;
			}

			if (!window.gui.user){
				window.gui.onNewProjectClick();
				return;
			}

			var songname = window.gui.user.branchname;
			if (songname === ""){
				window.gui.onNewProjectClick();
				return;
			} else {
				$('#gui-loading-progress').fadeIn("fast", function() {
					var user = window.gui.user;
					var msg = 'Just improved my cool song. Boom!';
					var data = window.gui.studio.project.configString();
					user.saveSong(data, msg, function() {
						window.gui.user = user;
						$('#gui-loading-progress').fadeOut("fast", function() {
							window.gui.alert ("Saved " + songname);
						});
					});
				});
			}
		};

		GUI.prototype.onMyWorkspaceClick = function(el) {
			if (!window.gui.credentials.uid || !window.gui.credentials.pwd){
				new User().onError({"status":401, "message":'{"errors":[{"resource": "New Project","message":"No user login"}]}'});
				return;
			}
			window.open("https://github.com/" + window.gui.credentials.uid + "/beatproducer-projects");
		};

		GUI.prototype.onDiscussSongClick = function(el) {
			if (!window.currentPublicProjectName){
				window.gui.alert("You can only discuss published songs. Open a public song now and give your two cents!");
			} else {
				window.open("https://github.com/s-a/beatproducer-projects/issues/new?title=" + window.currentPublicProjectName);
			}
		};

		GUI.prototype.onNewProjectClick = function(el) {
			var songname = $.trim(prompt ("Please give your new masterpice a unique name.","new-song")).toLowerCase().replace(/ /g, "-");
			if (!window.gui.credentials.uid || !window.gui.credentials.pwd){
				new User().onError({"status":401, "message":'{"errors":[{"resource": "New Project","message":"No user login"}]}'});
				return;
			}
			if (songname === ""){
				window.gui.alert ("Please enter a songname!");
			} else {
				$('#gui-loading-progress').fadeIn("fast", function() {
					var user = new window.boom.User();
					user.login(window.gui.credentials.uid, window.gui.credentials.pwd, function(){
						user.newSong(songname, function() {
							var msg = 'created a new song. yeah!';
							var data = window.gui.studio.project.configString();
							user.saveSong(data, msg, function() {
								window.gui.user = user;
								$('#gui-loading-progress').fadeOut("fast", function() {
									window.gui.alert ("Created new song " + songname);
								});
							});
						});
					});
				});
			}
		};

		GUI.prototype.onNewSamplerClick = function(el) {
			var self = window.gui;
			var arr = self.studio.project._el.state.devices;
			var device = new Device();
			device.project = self.studio.project;
			arr.push(device);
			self.studio.project._el.setState({devices:arr});
		};
		
		GUI.prototype.onPublishClick = function(el) {
			var self = window.gui;
			if (self.user && self.user.fork && self.user.branch){

				/*var username = window.gui.credentials.uid;
				var password = window.gui.credentials.pwd;

				if (username === "" || password === ""){
					window.gui.onLoginClick();
				} else {*/
					var user = self.user;
					//user.login(username, password, function(){
						user.saveSong(studio.project.configString(), 'changed the song', function() {
							user.publish(function() {
								$('#gui-loading-progress').fadeOut("fast", function() {
									window.gui.alert ("Pul request created. It may take a while until your request is processed.");
								});
							});
						});
						/*user.newSong(user.branchname, function() {
						});*/
					//});
				/*
				}*/
			} else {
				window.gui.alert("Create a new song or open a song from your personal workspace to publish.");
			}
		};

		GUI.prototype.loginAction = function() {
			window.gui.credentials.uid = this.parentElement.querySelector(".input-login-uid").value;
			window.gui.credentials.pwd = this.parentElement.querySelector(".input-login-pwd").value;
			var chk = $("#remember-login-password").get(0);
			if (chk.checked){
				$.cookie('uid', window.gui.credentials.uid, { expires: 365 });
				$.cookie('pwd', window.gui.credentials.pwd, { expires: 365 });
			}
		};

		GUI.prototype.initEventListeners = function() {
			var self = this;
			window.addEventListener('polymer-ready', function (e) {


				window.Polymer.addEventListener(document.getElementById('btn-login'), 'tap', self.loginAction);
				self.bpmSlider = document.querySelector('#bpm');
				self.bpmSlider.addEventListener('core-change', function() {
					if (self.studio.project){
						self.studio.project.bpm = self.bpmSlider.value;
					}
				});
			});

			document.addEventListener('DOMContentLoaded', function() {
				window.Polymer('x-foo', {
				});

				var openProjectByButtonClickFromChannel = function(sender, pub){
					var user = new window.boom.User();
					user.login(window.gui.credentials.uid, window.gui.credentials.pwd, function(){
						document.querySelector('#project-open-dialog').toggle();
						$('#gui-loading-progress').fadeIn("fast", function() {
							var $sender = $(sender);
							var uid = $sender.data("user");
							var name = $sender.data("name");
							var branchname = $sender.data("name");
							var filename = "projects/" + uid + " " + name + ".json";

							var repo = user.github.getRepo(pub ? "s-a" : window.gui.credentials.uid, "beatproducer-projects");
							var branch = repo.getBranch(pub ? "master" : branchname);

							var isBinary = false;
							branch.read(filename, isBinary).then(function(contents) {
								var project = JSON.parse(contents.content);
								window.studio.init(project, function(config) {
									if (pub){ // need new created project on save
										window.gui.user = null;
									} else { // can use current user an branch on save
										window.gui.user = user;
										window.gui.user.branch = branch;
										window.gui.user.branchname = branchname;
									}
									window.currentPublicProjectName = "Discussion about " + uid + "'s " + name;
								});
							}, user.onError);
						});
					});
				};

				window.Polymer('x-open-public-project-link', {
					onOpenProjectButtonClick: function(e, detail, sender) {
						openProjectByButtonClickFromChannel(sender, true);
					}
				});
				window.Polymer('x-open-private-project-link', {
					onOpenProjectButtonClick: function(e, detail, sender) {
						openProjectByButtonClickFromChannel(sender,false);
					}
				});

			});

			$(function() {
				$("#studio-button-new-sampler").click(self.onNewSamplerClick);
				$("#studio-button-publish").click(self.onPublishClick);
				$("#studio-button-login").click(self.onLoginClick);
				$("#studio-button-new").click(self.onNewProjectClick);
				$("#studio-button-open").click(self.onOpenProjectClick);
				$("#studio-button-save").click(self.onSaveProjectClick);
				$("#studio-button-my-workspace").click(self.onMyWorkspaceClick);
				$("#studio-button-project-discuss").click(self.onDiscussSongClick);
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
				User : User,
				GUI: GUI
			};
		}


})(jQuery, window.Waveform, window.Ciseaux);




var defaultProject = {
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




window.studio = new window.boom.Studio();
window.gui = new window.boom.GUI(window.studio);
window.studio.gui = window.gui;

$("body").on("react-components-ready", function() {
	window.studio.init(null, function(config) { 
		if(window.boomTestSuite){
			window.boomTestSuite();
		} else {
			$("#gui").get(0).responsiveWidth = "1920px";
			// load a  song?
		}
	});
	//window.studio.init(null, function(config) {});
	/*window.studio.init(null, function(config) {});*/

});
