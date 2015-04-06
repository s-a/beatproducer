;(function($, boom, BoomDevice, BoomProject, BoomPatternEditor) {

  var sampleDbPath = "./../audio/sample-db/";

  var Project = React.createClass({
    getInitialState: function() {
      return {
        devices:[/*new BoomDevice(),new BoomDevice()*/],
        name: "new project",
        bpm:0
      };
    },
    render: function() {
      var devices = this.state.devices.map(function(device, r) {
        var cls = "project-device project-device-container-" + r;
        return <div className={cls}><Device device={device} /></div>;
      }.bind(this));
      return  <div className="project-rack">
                {devices}
              </div> ;
    }
  });

  var Marker = React.createClass({
    onChange : function(e) {
      var val = parseFloat(e.target.value);
      var device = this.props.device;
      var pos = device.spectrumPosition({seconds:val});
      var index = parseInt(this.props.index);
      this.props.marker.seconds = val;
      device.markers[index] = pos;
      device.refreshSpectrum();
      device.chopSlices();
      device.project.studio.patternEditor.open(device);
      device.spectrumCursorPosition(pos.x);
    },
    onFocus : function(e) {
      var device = this.props.device;
      var val = parseFloat(e.target.value);
      var pos = device.spectrumPosition({seconds:val});
      device.spectrumCursorPosition(pos.x);
    },
    render : function() {
      var marker = this.props.marker;
      var val = marker.seconds;
      var max = this.props.device.audioBuffer.duration;
      return <div>
        <input onChange={this.onChange} onFocus={this.onFocus} value={val} type="range" min="0" max={max} /> <input onChange={this.onChange} onFocus={this.onFocus} type="number" min="0" max={max} value={val} /> <span>delete</span>
      </div>;
    }
  });

  var Device = React.createClass({
    handleOnDeleteDeviceClick : function() {
      var devices = this.state.device.project._el.state.devices;
      
      var _id = this.state.device._id;
      for (var i = 0; i < devices.length; i++) {
        var device = devices[i];
        if (device._id === _id) {
          devices.splice(i, 1);
          break;
        }
      }
      var $el = this.state.device.$();
      $el.fadeOut("slow", function() {
          $el.remove();
      });

      // FIXME: setState crashes device list state
      // this.state.device.project._el.setState({devices:devices});
    },
    handleOnRenameDeviceClick : function() {
      var deviceName = $.trim(prompt ("Please enter a name for this device",this.state.name)).toLowerCase().replace(/ /g, "-");
      if (deviceName !== ""){
        var device = this.state.device;
        device.name = deviceName;
        this.setState({device: device, name:deviceName});
      }
    },
    handleOnOpenPatternEditorClick :function() {
      $("#pattern-editor").slideDown("fast");
      window.studio.patternEditor.open(this.state.device);
    },
    handleOnOpenClick :function() {
      this.state.device.open( sampleDbPath + "beatproducer-drum-loops-pack-1/bpnet_another-day-in-paradise_095bpm_4bars.wav", function  () {
      });
    },
    handleOnPlayClick :function() {
      this.state.device.play();
    },
    handleOnPauseClick :function() {
      this.state.device.pause();
    },
    handleOnStopClick :function() {
      this.state.device.stop();
    },
    cursorPosition : function  (evt) {
        var $el = $(evt.target); 
        var parentOffset =  $el.parent().offset(); 
        var x =  evt.pageX - parentOffset.left;
        return x;
    },
    onSprectrumMouseLeave: function(evt) { 
      this.state.device.spectrumCursorPosition(null);
    },
    onSprectrumMouseMove: function(evt) {
      var x =  this.cursorPosition(evt);
      this.state.device.spectrumCursorPosition(x);
    },
    onSpectrumMouseClick: function(evt) {
        var device = this.state.device;
        var pos = device.spectrumPosition({x : this.cursorPosition(evt)});
        if (pos){
          device.markers.push(pos);
          device.refreshSpectrum();
          device.chopSlices();
          device.project.studio.patternEditor.open(device);

        }
    },
    getInitialState: function() {
      if (this.props.device){
        var device = this.props.device;
        device._el = this;
      }
      return {
        device: device,
        name: "New Sampler",
        currentTime: 0
      };
    },
    render: function() {
      var markers = null;
      if (this.state.device.markers){
        markers = this.state.device.markers.map(function(marker, s) {
          return <Marker key={s} index={s} marker={marker} device={this.state.device} />;
        }.bind(this));
      }
       
      return  <div key={this.state.device._id} className="device-element-outset device">
                <strong onClick={this.handleOnRenameDeviceClick} className="device-name">{this.state.device._id} {this.state.name}</strong> <small className="device-transport-time">{this.state.currentTime}</small>
                <div>
                  <div onClick={this.onSpectrumMouseClick} onMouseMove={this.onSprectrumMouseMove}  onMouseLeave={this.onSprectrumMouseLeave} className="device-spectrum device-element-inset"></div>
                </div>
                <a className="device-button device-button-play" href="javascript:void(0);" onClick={this.handleOnPlayClick}><img width="32" src="assets/images/ic_play_circle_fill_48px.svg" type="image/svg+xml" /></a> 
                <a className="device-button device-button-pause" href="javascript:void(0);" onClick={this.handleOnPauseClick}><img width="32" src="assets/images/ic_pause_circle_fill_48px.svg" type="image/svg+xml" /></a> 
                <a className="device-button device-button-stop" href="javascript:void(0);" onClick={this.handleOnStopClick}><img width="32" src="assets/images/ic_stop_48px.svg"/></a> 
                <a className="device-button device-button-opensample" href="javascript:void(0);" onClick={this.handleOnOpenClick}><img width="32" src="assets/images/ic_folder_open_48px.svg"/></a> 
                <a className="device-button device-button-pattern-editor" href="javascript:void(0);" onClick={this.handleOnOpenPatternEditorClick}><img width="32" src="assets/images/ic_queue_music_48px.svg"/></a> 
                <a className="device-button device-button-pattern-editor" href="javascript:void(0);" onClick={this.handleOnDeleteDeviceClick}><img width="32" src="assets/images/ic_delete_48px.svg"/></a> 
                <div>
                  {markers} 
                </div>
              </div>;
    }
  });

  var PatternEditor = React.createClass({
    getInitialState: function() {
      if (this.props.patternEditor){
        var patternEditor = this.props.patternEditor;
        patternEditor._el = this;
      }
      return {
        connectedDevice : null,
        patternEditor: patternEditor,
        connectedDeviceName : "[xNONE]"
      };
    },
    keyIsEquiped : function (index) {
      var result = "";
      if (this.state && this.state.connectedDevice ){
        if (this.state.connectedDevice.slices[index]) {
            return true;
        };
      }
      return false;
    },
    handleOnKeyClick :function(e) {
      var sliceIndex = parseInt($(e.currentTarget).attr("data"));
      this.state.connectedDevice.slices[sliceIndex].play();
    },
    handleOnPlayClick : function  (e) {
      this.state.connectedDevice.patterns[0].play();
    },
    handleOnPauseClick : function  (e) {
      this.state.connectedDevice.patterns[0].pause();
    },
    handleOnStopClick : function  (e) {
      this.state.connectedDevice.patterns[0].stop();
    },
    handleOnStepClick : function  (e) {
      var $el = $(e.target);
      var sliceIndex = parseInt($el.data("slice-index"));
      var step = parseInt($el.data("step"));
      var device = this.state.connectedDevice;
      var sequence = device.patterns[0].sequence;
      var subSequence = sequence[step];
      var sliceIdx = subSequence.indexOf(sliceIndex);
      if (sliceIdx === -1){
        subSequence.push(sliceIndex);
      } else {
        subSequence.splice(sliceIdx, 1);
      }
      //$el.toggleClass("pattern-keyboard-step-active");
      this.setState({connectedDevice: device});
    },
    render: function() {
      var self = this;
      var baseNotes = ["C", "C#","D", "D#","E","F", "F#","G", "G#","A", "A#","B"];
      var notes = []
        .concat(baseNotes)
        .concat(baseNotes)
        .concat(baseNotes)
        .concat(baseNotes)
        .concat(baseNotes)
        .concat(baseNotes)
        .concat(baseNotes)
        .concat(baseNotes)
        ;
      var octave = 4;
      var index = 0;
      var getCols = function  (note) {
        index++;

        var cols = [];
        var keyClassName = "pattern-keyboard-key";
        if (note.indexOf("#") !== -1){
          keyClassName += " pattern-keyboard-key-sharp";
        }
        if (note === "B"){
          octave--;
        }


        if (self.keyIsEquiped(index-1)){
          cols.push(<div data={index-1} onClick={self.handleOnKeyClick} className={keyClassName}>{note}{octave}</div>);
          if (note.indexOf("#") !== -1){
            cols.push(
              <div onClick={self.handleOnKeyClick}  className="pattern-keyboard-step-offset"><div  onClick={self.handleOnKeyClick} className="pattern-keyboard-step-offset-top"></div><div className="pattern-keyboard-step-offset-bottom"></div></div>
            );
          }

          var activePatternIndex = 0;
          if (self.state && self.state.connectedDevice ){
            if (self.state.connectedDevice.patterns) {
              var pattern = self.state.connectedDevice.patterns[activePatternIndex];
              for (var bar = 0; bar < pattern.bars; bar++) {
                var steps = pattern.sequence.length;
                for (var step = 0; step < steps ; step++) {
                  var className = "pattern-keyboard-step";
                  var subSequence = pattern.sequence[step];
                  if (subSequence.indexOf(index) !== -1){
                    className += " pattern-keyboard-step-active";
                  }
                  cols.push(<div onClick={self.handleOnStepClick} data-slice-index={index} data-step={step} className={className}>X</div>);
                }
              };

            }
          }


        }
        return cols;
      }

      var rows = [];
      for (var i = notes.length - 1; i >= 0; i--) {
        var note = notes[i];
        var rowClassName = "pattern-row";
        if (note.indexOf("#") !== -1){
          rowClassName += " pattern-row-sharp";
        }
        var cols = getCols(note);
        rows.push(
          <div className={rowClassName}>
            <div className="pattern-keyboard">
              {cols}
            </div>
          </div>
        );
      };

      return  <div className="device-element-outset device">
                <a className="device-button device-button-play" href="javascript:void(0);" onClick={this.handleOnPlayClick}><img width="32" src="assets/images/ic_play_circle_fill_48px.svg" type="image/svg+xml" /></a> 
                <a className="device-button device-button-stop" href="javascript:void(0);" onClick={this.handleOnStopClick}><img width="32" src="assets/images/ic_stop_48px.svg" type="image/svg+xml" /></a> 
                <strong className="device-name">PE</strong> - <small className="device-transport-time">{this.state.connectedDeviceName}</small> | <small className="device-transport-time">PATTERN NAME</small>
                <div className="device-element-outset pattern-editor">
                  <div className="pattern">{rows}</div>
                </div> 
              </div> 
                ;
    }
  });
  
  BoomDevice.prototype.render = function(done) {
    var self = this;
    React.render(<Device />, self.parentElement, done);
  };

  BoomProject.prototype.render = function(done) {
      var self = this;
      React.render(<Project />, self.parentElement, done);
  };

  BoomPatternEditor.prototype.render = function(done) {
      var self = this;
      React.render(<PatternEditor />, document.getElementById("pattern-editor"), done);
  };



  $("body").trigger("react-components-ready");


  

})(window.jQuery, window.boom, window.boom.Device, window.boom.Project, window.boom.PatternEditor);