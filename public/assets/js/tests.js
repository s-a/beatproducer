(function() {


	var testProject = {
		bpm : 080,
		name : "test-project",
		devices: [
			{
				sample : "../../test/looperman-a-0818593-0006779-shamoozey-to-be-or-nor-to-be.wav",
				slices : [0.32828497639153165,0.8020598855020374,1.413863705140801,2.081625191209939,2.618818788941536],
				patterns : []
			}
		]
	};


	var test = function  () {


		if (navigator.userAgent.indexOf('SlimerJS') !== -1) {

			before(function(done) {
				window.studio.init(testProject, function() {
					done();
				});
			});

			describe("simple test", function() {
				it("should test", function(){
					assert(true, "1!==1");
				});
			});

			describe("Studio", function() {

				this.timeout(10000);

				it("should have loaded project samplers", function(){
					assert(window.studio.project._el.state.devices.length === 1);
				});

				it("should have chopped sample slices", function(){
					//FIXME : should be 5!!! chopslices have to add last slice automatic
					assert(window.studio.project._el.state.devices[0].slices.length === 4); 
				});

				it("should should play sample", function(done){
					window.studio.project._el.state.devices[0].play(function() {
						done();
					});
				});

				it("should should play each slice", function(done){
					var sliceIdx = window.studio.project._el.state.devices[0].slices.length-1;
					var playSlice = function(idx) {
						window.studio.project._el.state.devices[0].slices[sliceIdx].play(function() {
							sliceIdx--;
							if (sliceIdx === -1){
								done()
							} else {
								playSlice(sliceIdx);
							}
						});
					};
					playSlice(sliceIdx);
				});
			});
			var runner = window.mocha.run();
		} else {
			if (document.location.hostname === "localhost"){
				window.studio.init(window.defaultProject);
			}
		}
	};


	window.boomTestSuite = test;
})();