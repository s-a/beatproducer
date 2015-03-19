(function() {

	var setup = {};


	var Effect = function(audioContext, connectTo, config) {
		setup = config;
		this._id = window.sa.webAudioFX._id;
		window.sa.webAudioFX._id++;



		this.output = audioContext.createDynamicsCompressor();
		if (connectTo){
			this.output.connect(connectTo);
		}
		this.output.threshold.value = config.threshold;
		this.output.knee.value = config.knee;
		return this;
	}

	Effect.prototype.configs = function () { 
		return {
			"threshold": {
				"name" 			: "Threshold",
				"type"			: Number,
				"description"	: "todo",
				"val"			: this.threshold
			},
			"knee": {
				"name" 			: "Knee",
				"type"			: Number,
				"description"	: "todo",
				"val"			: this.knee
			}
		};
	};




	Effect.prototype.threshold = function(value) {
		if (value){
			setup.threshold = value;
			this.output.threshold.value = value;
		} else {
			return setup.threshold;
		}
	};

	Effect.prototype.knee = function(value) {
		if (value){
			setup.knee = value;
			this.output.knee.value = value;
		} else {
			return setup.knee;
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
	if(!window.sa.webAudioFX.Compressor){ window.sa.webAudioFX.Compressor = Effect; }
	if(!window.sa.webAudioFX._id){ window.sa.webAudioFX._id = 0; }
})();