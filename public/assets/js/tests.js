(function() {

	var test = function  () {
		if (navigator.userAgent.indexOf('SlimerJS') !== -1) {

			describe("simple test", function() {
				it("should test", function(){
					assert(true, "1!==1");
				});
			});

			describe("Studio", function() {
				it("should should load project", function(done){
					window.studio.init(window.defaultProject, function(config) { 
						assert(window.studio.project._el.state.devices.length === 1, "1!==1");
						done(); 
					});

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