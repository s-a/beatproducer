(function() {

	var setup = {};


	var Effect = function(audioContext, connectTo, config) {
		setup = config;
		this._id = window.sa.webAudioFX._id;
		window.sa.webAudioFX._id++;


		this.output = audioContext.createDelay();
		if (connectTo){
			this.output.connect(connectTo);
		}
		this.output.delayTime.value = config.delayTime;
		return this;
	}

	Effect.prototype.configs = function () { 
		return {
			"delayTime": {
				"name" 			: "Delay Time",
				"type"			: Number,
				"description"	: "todo",
				"val"			: this.delayTime
			}
		};
	};

	Effect.prototype.delayTime = function(value) {
		if (value){
			setup.delayTime = value;
			this.output.delayTime.value = value;
		} else {
			return setup.delayTime;
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
	if(!window.sa.webAudioFX.Delay){ window.sa.webAudioFX.Delay = Effect; }
	if(!window.sa.webAudioFX._id){ window.sa.webAudioFX._id = 0; }
})();