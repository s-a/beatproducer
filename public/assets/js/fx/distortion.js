(function() {

	var setup = {};

	var makeDistortionCurve = function (amount) {
	  var k = typeof amount === 'number' ? amount : 50,
	    n_samples = 44100,
	    curve = new Float32Array(n_samples),
	    deg = Math.PI / 180,
	    i = 0,
	    x;
	  for ( ; i < n_samples; ++i ) {
	    x = i * 2 / n_samples - 1;
	    curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
	  }
	  return curve;
	};

	var Effect = function(audioContext, connectTo, config) {
		setup = config;
		this._id = window.sa.webAudioFX._id;
		window.sa.webAudioFX._id++;

		this.output = audioContext.createWaveShaper();
		if (connectTo){
			this.output.connect(connectTo);
		}
		this.output.curve = makeDistortionCurve(config.curve);
		this.output.oversample = config.oversample + "x";
		return this;
	}

	Effect.prototype.configs = function () { 
		return {
			"oversample": {
				"name" 			: "Oversample",
				"type"			: Number,
				"description"	: "todo",
				"val"			: this.oversample
			},
			"curve": {
				"name" 			: "Curve",
				"type"			: Number,
				"description"	: "todo",
				"val"			: this.curve
			},
		};
	};

	Effect.prototype.oversample = function(value) {
		if (value){
			setup.oversample = value;
			this.output.oversample = value + "x";
		} else {
			return setup.oversample;
		}
	};

	Effect.prototype.curve = function(value) {
		if (value){
			setup.curve = value;
			this.output.curve = makeDistortionCurve(value);
		} else {
			return setup.curve;
		}
	};

	Effect.prototype.connect = function(destination) {
		this.output.connect(destination);
	};

	Effect.prototype.disconnect = function() {
		this.output.disconnect();
	};

	if(!window.sa){ window.sa = {}; }
	if(!window.sa.webAudioFX){ window.sa.webAudioFX = {}; }
	if(!window.sa.webAudioFX.Distortion){ window.sa.webAudioFX.Distortion = Effect; }
	if(!window.sa.webAudioFX._id){ window.sa.webAudioFX._id = 0; }
})();