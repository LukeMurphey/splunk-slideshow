require.config({
    paths: {
        text: "../app/slideshow/contrib/text",
        bootstrap_dualist: "../app/slideshow/contrib/bootstrap-duallist/jquery.bootstrap-duallistbox.min",
        store: "../app/slideshow/contrib/store.min",
        nprogress: "../app/slideshow/contrib/nprogress/nprogress",
    },
	shim: {
	    'store': {
	    	exports: 'store'
	    },
    	'bootstrap_dualist': {
    		deps: ['jquery']
    	},
	    nprogress: {
	    	exports: 'NProgress',
	    	deps: ['jquery']
	    }
	}
});

define([
    "underscore",
    "backbone",
    "splunkjs/mvc",
    "jquery",
    "splunkjs/mvc/simplesplunkview",
    "splunkjs/mvc/simpleform/input/dropdown",
    "splunkjs/mvc/simpleform/input/text",
    "text!../app/slideshow/js/templates/SlideshowSetupPage.html",
    "store",
    "css!../app/slideshow/css/SlideshowSetupView.css",
    "bootstrap_dualist",
    "nprogress",
    "css!../app/slideshow/contrib/bootstrap-duallist/bootstrap-duallistbox.min.css",
], function(_, Backbone, mvc, $, SimpleSplunkView, DropdownInput, TextInput, SlideshowSetupPageTemplate, store){
	
    // Define the custom view class
    var SlideshowSetupView = SimpleSplunkView.extend({
    	
        className: "SlideshowSetupView",

        /**
         * Setup the defaults
         */
        defaults: {
        	'interval': 500,
        	'use_iframe': true
        },
        
        /**
         * Wire up the events
         */
        events: {
        	"click #start_show" : "startShow",
        	"click #stop_show" : "stopShow",
        	"click .predefined-interval" : "setPredefinedInterval",
        	"click #overlay_stop_show": "stopShow"
        },
        
        initialize: function() {
        	
        	// Apply the defaults
        	this.options = _.extend({}, this.defaults, this.options);
        	
        	this.interval = this.options.interval;
        	this.use_iframe = this.options.use_iframe;
        	
        	this.available_views = null;
        	this.available_apps = null;
        	
        	// These variables are used for running the show and will be set when the show begins
        	this.slideshow_window = null;
        	this.slideshow_view_offset = null;
        	this.slideshow_views = null;
        	this.slideshow_delay = null;
        	this.slideshow_hide_chrome = null;
        	this.slideshow_view_loaded = null;
        	this.slideshow_progress_bar_created = false;
        	this.slideshow_is_running = false;
        	this.slideshow_invert_colors = false;
        	
        	this.hide_controls_check_interval = null;
        	this.hide_controls_time_delay = null;
        	this.hide_controls_last_mouse_move = null;
        	this.ready_state_check_interval = null;
        	
        	
        	this.view_overrides = [
        			{
        				'view' : 'incident_review',
        				'app' : 'SA-ThreatIntelligence',
        				'app_override' : 'SplunkEnterpriseSecuritySuite'
        			},
        			{
        				'app' : 'DA-ESS-AccessProtection',
        				'app_override' : 'SplunkEnterpriseSecuritySuite'
        			},
        			{
        				'app' : 'DA-ESS-EndpointProtection',
        				'app_override' : 'SplunkEnterpriseSecuritySuite'
        			},
        			{
        				'app' : 'DA-ESS-IdentityProtection',
        				'app_override' : 'SplunkEnterpriseSecuritySuite'
        			},
        			{
        				'app' : 'DA-ESS-NetworkProtection',
        				'app_override' : 'SplunkEnterpriseSecuritySuite'
        			}
        	]
        	
        	this.duration_units = [
        	                       {
        	                    	   'unit' : 'd',
        	                    	   'number' : 86400
        	                       },
        	                       {
        	                    	   'unit' : 'h',
        	                    	   'number' : 3600
        	                       },
        	                       {
        	                    	   'unit' : 'm',
        	                    	   'number' : 60
        	                       },
        	                       {
        	                    	   'unit' : 's',
        	                    	   'number' : 1
        	                       }
        	                       ]
        	
        },
        
        /**
         * Show the help dialog
         */
        showHelp: function(message_html){
        	$('#help-dialog-text', this.$el).html(message_html);
        	$('#help-dialog', this.$el).modal();
        },
        
        /**
         * Set the interval to one of the predefined ones.
         */
        setPredefinedInterval: function(element){
        	$('[name="delay"]').val( $(element.currentTarget).data('value') );
        },
        
        /**
         * Take a duration description and return the number of seconds.
         */
        getSecondsFromReadableDuration: function(duration){
        	
        	var re = /^\s*([0-9]+([.][0-9]+)?)\s*([dhms])?\s*$/gi;
        	var match = re.exec(duration);
        	
        	if( match ){
        		number = parseFloat(match[1]);
        		units = match[3];
        		
        		// If no units were provided, then assume seconds
        		if( !units ){
        			return number;
        		}
        		
        		// Get the duration multiplier
        		var multiplier = 1;
        		
        		for(var c = 0; c < this.duration_units.length; c++){
        			if( this.duration_units[c]['unit'] === units ){
        				multiplier = this.duration_units[c]['number'];
        			}
        		}
        		
        		// Return the number in seconds
        		return multiplier * number;
        		
        	}
        	
        	// Couldn't get a match, number is invalid.
        	return null;
        },
        
        /**
         * Take number of seconds and return the readable duration.
         */
        getReadableDurationFromSeconds: function(val){
        	
        	var seconds = this.parseFloatIfValid(val);
        	
        	// If the value is not valid, then stop
        	if( isNaN(seconds) ){
        		return val;
        	}
        	
        	// Find the best matching unit
    		for(var c = 0; c < this.duration_units.length; c++){
    			if( (seconds % this.duration_units[c]['number']) === 0 ){
    				return (seconds / this.duration_units[c]['number']).toString() + this.duration_units[c]['unit'];
    			}
    		}
    		
        	// No entry found, just convert it to seconds
        	return seconds.toString() + "s";
        	
        },
        
        /**
         * Validate the given field
         */
        validateField: function(field_selector, val, message, test_function){
            if( !test_function(val) ){
                $(".help-inline", field_selector).show().text(message);
                $(field_selector).addClass('error');
                return 1;
            }
            else{
                $(".help-inline", field_selector).hide();
                $(field_selector).removeClass('error');
                return 0;
            }
        },
        
        /**
         * Validate the form values.
         */
        validate: function(){
        	
        	var failures = 0;
        	
            // Verify that the delay is a valid integer between 1 and 100,000
            failures += this.validateField( $('#delay_control_group'), $('[name="delay"]').val(), "Must be a valid duration greater than zero",
                    function(val){
            			var secs = this.getSecondsFromReadableDuration(val);
                        return secs !== null && secs > 0;
                    }.bind(this)
            );
            
            // Verify that at least one view has been selected
            failures += this.validateField( $('#views_control_group'), $('[name="views_list"]').val(), "Must select at least one view",
                    function(val){ 
                        return val !== undefined && val !== null;
                    }
            );
        	
            return failures === 0;
        },
        
        /**
         * Get the detailed information about the view that matches the given name.
         */
        getViewForName: function(name){
        	
    		// Find the view meta-data associated with this selected view
    		for( var c = 0; c < this.available_views.length; c++){
    			
    			if(this.available_views[c].name == name){
    				return this.available_views[c];
    			}
    		}
        },
        
        /**
         * Start the show in a new window.
         */
        startShow: function(){
        	
        	// Make sure the settings are valid
        	if( !this.validate() ){
        		//Show cannot be started, something doesn't validate
        		return false;
        	}
        	
        	// Get the views put into a list
        	var selected_views = $('[name="views_list"]', this.$el).val();
        	var views = [];
        	
        	for( var c = 0; c < selected_views.length; c++){
        		
        		var view_meta = this.getViewForName(selected_views[c]);
        		
        		views.push({
        			'name' : selected_views[c],
        			'app'  : view_meta.acl.app
        		})
        	}
        	
        	var delay_readable = $('[name="delay"]', this.$el).val();
        	var delay = this.getSecondsFromReadableDuration( delay_readable );
        	var hide_chrome = $('[name="hide_chrome"]:first', this.$el).prop("checked");
        	var invert_colors = $('[name="invert_colors"]:first', this.$el).prop("checked");
        	
        	// Save the settings
        	store.set('views', views );
        	store.set('view_delay', delay);
        	store.set('view_delay_readable', delay_readable);
        	store.set('hide_chrome', hide_chrome);
        	store.set('invert_colors', invert_colors);
        	
        	// Initialize the slideshow parameters so that we can run the show
        	this.slideshow_window = null;
        	this.slideshow_view_offset = 0;
        	this.slideshow_views = views;
        	this.slideshow_delay = delay;
        	this.slideshow_hide_chrome = hide_chrome;
        	this.slideshow_invert_colors = invert_colors;
        	
        	// Note that the show has begun
        	this.slideshow_is_running = true;
        	
        	// Open the window with the first view
        	this.goToNextView();
        	
        	// Start the process
        	this.executeSlideshowCycle();
        	
        	// Show the start button
        	this.toggleStartButton(false);
        },
        
        /**
         * Toggle the start button or stop button.
         */
        toggleStartButton: function(show_start){
        	
        	if( typeof show_start === undefined ){
        		var show_start = true;
        	}
        	
        	if( show_start ){
        		$("#stop_show", this.$el).hide();
            	$("#start_show", this.$el).show();
        	}
        	else{
        		$("#stop_show", this.$el).show();
            	$("#start_show", this.$el).hide();
        	}
        },
        
        /**
         * Make the URL to forward the user to.
         */
        makeViewURL: function(view, app, hide_controls){
        	
        	var app_to_use = app;
        	
        	// See if an app override exists for this app
        	for(var c = 0; c < this.view_overrides.length; c++){
        		
        		// Does the app match this entry? If not skip to the next one
        		if( this.view_overrides[c].hasOwnProperty('app') && this.view_overrides[c].app !== app ){
        			continue;
        		}
        		
        		// Does the view match this entry? If not skip to the next one
        		if( this.view_overrides[c].hasOwnProperty('view') && this.view_overrides[c].view !== view ){
        			continue;
        		}
        		
        		// Found a match
        		app_to_use = this.view_overrides[c].app_override;
        		
        		console.info("Using an app override for the view '" + view + "'; override app is '" + app_to_use + "'");
        		break;
        	}
        	
        	// Make sure that the app is visible, then show the view in the slideshow app if it is
        	if( this.available_apps !== null ){
        		
        		for(c = 0; c < this.available_apps.length; c++){
        			if( app_to_use === this.available_apps[c].name ){
        				
        				// If the app is invisible, then show the view in the slideshow app
        				if( !this.available_apps[c].content.visible ){
        					app_to_use = 'slideshow';
        					console.info("The view '" + view + "' is not associated with a visible app");
        				}
        				
        				// Found, we are done here
        				break;
        			}
        		}
        	}
        	
        	// Make the URL and return it
        	var url = "../" + app_to_use + "/" + view;
        	
        	if(hide_controls){
        		url = url + "?hideEdit=true&hideTitle=true&hideSplunkBar=true&hideAppBar=true&hideFooter=true&targetTop=true";
        	}
        	
        	return url;
        },
        
        /**
         * Show the overlay controls
         */
        showOverlayControls: function(){
			
        	// Note when the activity occurred
    		this.hide_controls_last_mouse_move = new Date().getTime();
        	
			// Show the overlay
			$('#overlay-controls').show();
			$('#overlay-controls').animate({
				top: "0"
			});
			
        },
        
        /**
         * Hide the overlay controls
         */
        hideOverlayControls: function(dofast){
        	
        	if(typeof dofast === 'undefined'){
        		dofast = false;
        	}
        	
        	if(dofast){
        		$('#overlay-controls').hide();
        	}
        	
			$('#overlay-controls').animate({
				top: "-100"
			});
        	
        },
        
        /**
         * Wire up the slide frame controls
         */
        wireUpSlideFrameControls: function(){
        	
			// Store a reference to the window
			var showframe = document.getElementById("showframe");
			this.slideshow_window = showframe.contentWindow;
        	
        	// Wire up the handler to show the stop show option
        	setTimeout(function(){
            	$(this.slideshow_window.document).mousemove(function() {
                		console.info("Mouse move detected; showing overlay controls");
                		this.showOverlayControls();
                	}.bind(this));
        	}.bind(this), 2000);
        	
        },
        
        /**
         * This is a delay check to hide the overlay controls when necessary
         */
        hideControlsDelayCheck: function(){
        	console.info("Checking controls: " + (new Date().getTime() - this.hide_controls_last_mouse_move).toString());
        	
    		if((new Date().getTime() - this.hide_controls_last_mouse_move) >= 5000){
    			this.hideOverlayControls();
    		}
    		
        },
        
        /**
         * Show the frame that will contain the slideshow
         */
        showSlideshowFrame: function(){
        	
			// Make the frame if necessary
			if($('#showframe').length === 0){
				$('<iframe id="showframe">').appendTo('body');
				
				$('#showframe').resize(function() {
					$('#showframe').css("height", $(window).height());
				});
			}
			
			$('#showframe').css("height", $(window).height());
			$('#showframe').show();
        	
			// Wire up the handler to hide the overlay controls
        	this.hide_controls_time_delay = 1;
			
			this.wireUpSlideFrameControls();
			
			if(this.hide_controls_check_interval === null){
				this.hide_controls_check_interval = setInterval(this.hideControlsDelayCheck.bind(this), 500);
			}
        },
        
        /**
         * Show the loading frame
         */
        showLoadingFrame: function(){
        	
			// Make the loading frame if necessary
			if($('#loadingframe').length === 0){
				$('<iframe id="loadingframe">').appendTo('body');
				$('#loadingframe').appendTo('body');
				
				var loadingframe = document.getElementById("loadingframe");
				var loadingFrameDocument = loadingframe.contentDocument.document;
			}
			
			// Set the background color as appropriate
			if(this.slideshow_invert_colors){
				$('#loadingframe').contents().find('body').css("margin", '0px').css("background-color", '#080808');
			}
			else{
				$('#loadingframe').contents().find('body').css("margin", '0px').css("background-color", '#EAEAEA');
			}
			
			$('#loadingframe').css("height", $(window).height());
			$('#loadingframe').show();
        },
        
        /**
         * Hide the loading frame
         */
        hideLoadingFrame: function(){
        	$('#loadingframe').hide();
        },
        
        /**
         * Is the browser Internet Explorer
         */
        isInternetExplorer: function(){
        	return window.navigator.userAgent.match(/Trident.*rv\:11\./);
        },
        
        /**
         * Is the browser Firefox
         */
        isFirefox: function(){
        	return navigator.userAgent.indexOf("Firefox") > -1;
        },
        
        /**
         * Invert the colors of the document.
         */
        invertDocumentColors: function(win){
        	
        	doc = win.document;
        	
        	// the css we are going to inject
        	var css = 'html {-webkit-filter: invert(100%);' +
        	    '-moz-filter: invert(100%);' + 
        	    '-o-filter: invert(100%);' + 
        	    '-ms-filter: invert(100%);' +
        	    'filter: invert(100%);' +
        	    'height: 100%;' +
        	    (this.isFirefox() ? 'background-color: black;' : '' ) +
        	    'zoom: 1;' +
        	    '}';
        	
        	// Add this for Internet Explorer
        	if( this.isInternetExplorer() ){
        	    css = css + 'body:before {' +
        	    'content:"";' +
        	    'position:fixed;' +
        	    'top:50%; left: 50%;' +
        	    'z-index:9999;' +
        	    'width:1px; height: 1px;' +
        	    'outline:2999px solid invert;' +
        	    '}'
        	}
        	
        	head = doc.getElementsByTagName('head')[0],
        	style = doc.createElement('style');

        	style.type = 'text/css';
        	
        	if (style.styleSheet){
        		style.styleSheet.cssText = css;
        	} else {
        		style.appendChild(doc.createTextNode(css));
        	}

        	// Inject the css to the head
        	head.appendChild(style);
        },
        
        /**
         * Go to the next view in the list.
         */
        goToNextView: function(){
        	
        	// Get the view that we are showing
        	var view = null;
        	
        	// If the view offset is undefined start at the beginning
        	if( this.slideshow_view_offset === null ){
        		this.slideshow_view_offset = 0;
        	}
        	else{
        		this.slideshow_view_offset++; 
        	}
        	
        	// If the we went off of the end, then wrap around
        	if( this.slideshow_view_offset >= this.slideshow_views.length ){
        		this.slideshow_view_offset = 0;
        	}

        	// Get the view
        	view = this.slideshow_views[this.slideshow_view_offset];
        	
        	console.info("Changing to next view: " + view.name);
        	
        	// Clear the existing interval
        	if(this.ready_state_check_interval){
        		clearInterval(this.ready_state_check_interval);
        		this.ready_state_check_interval = null;
        	}
        	
        	// Make the window if necessary
        	if( !this.slideshow_window ){
        		
        		// Make the window ...
        		if(!this.use_iframe){
        			this.slideshow_window = window.open(this.makeViewURL(view.name, view.app, this.slideshow_hide_chrome), "_blank");
        		}
        		
        		// ... or make the iframe
        		else{
        			
        			// Make the frame window
        			this.showSlideshowFrame();
        			
        			// Show the loading frame
        			this.showLoadingFrame();
        			
        			// Go to the first view
        			this.slideshow_window.location = this.makeViewURL(view.name, view.app, this.slideshow_hide_chrome);
        		}
        		
        		// Stop if the window could not be opened
        		if(!this.slideshow_window && this.slideshow_is_running){
        			console.warn("Slideshow popup window was not defined; this is likely due to a popup blocker");
        			this.showPopupWasBlockedDialog();
        			this.stopShow();
        		}
        		
        		// Detect if the window opened successfully
        		else{
	        		
        			setTimeout(function () {
        				
        				// Stop if the window was closed
        				if(!this.isSlideshowWindowDefined()){
        					return;
        				}
        				
	        		    if(this.slideshow_window.innerHeight <= 0){
	        		    	console.warn("Slideshow popup window has an inner height of zero; this is likely due to a popup blocker");
	        		    	this.showPopupWasBlockedDialog();
	        		    	this.stopShow();
	        		    }
	        		    else{
	        		    	console.info("Popup window was created successfully (was not popup blocked)");
	        		    }
	        		}.bind(this), 3000);
        			
        		}
        	}
        	
        	// Otherwise, change the window
        	else{
        		
        		// Stop if the window was closed
        		if(!this.isSlideshowWindowDefined()){
        			console.info("Window was closed, show will stop");
        			this.stopShow();
        			return;
        		}
        		
        		// Change to the new view
        		this.slideshow_window.location = this.makeViewURL(view.name, view.app, this.slideshow_hide_chrome);
        		
    			// Show the loading frame
    			this.showLoadingFrame();
    			
    			this.wireUpSlideFrameControls();
        	}
        	
        	// Load the stylesheets and progress indicator as necessary when the page gets ready enough
        	this.ready_state_check_interval = setInterval(function() {
        		
        		// Stop if the window is closed or null
        		if(!this.isSlideshowWindowDefined() || !this.slideshow_is_running){
        			clearInterval(this.ready_state_check_interval);
        			return;
        		}
        		
        		// See if the document is ready and update it if it is
        		if( (this.slideshow_window.document.readyState === 'loaded'
        			|| this.slideshow_window.document.readyState === 'interactive'
        			|| this.slideshow_window.document.readyState === 'complete')
        			&& this.slideshow_window.document.body !== null
        			&& this.slideshow_window.document.body.innerHTML.length > 0
        			&& !$(this.slideshow_window.document.body).hasClass("slideshow-initialized") ){
        			
        			// Add a placeholder to track whether the CSS was loaded
        			$(this.slideshow_window.document.body).addClass("slideshow-initialized");
        			
        			// Load the CSS for the progress indicator
        			this.addStylesheet("../../static/app/slideshow/contrib/nprogress/nprogress.css", this.slideshow_window.document);
        			
               	 	// Start the progress indicator
        			if( !this.isInternetExplorer() ){
	               	 	NProgress.configure({
	               	 							showSpinner: false,
	               	 							document: this.slideshow_window.document
	               	 						});
	               	 	
	               	 	this.slideshow_progress_bar_created = true;
        			}
        	    	
        	    	// Hide the chrome if requested
        	    	if( this.slideshow_hide_chrome ){
        	    		this.addStylesheet("../../static/app/slideshow/css/HideChrome.css", this.slideshow_window.document);
        	    		console.info("Successfully loaded the stylesheet for hiding chrome");
        	    	}
        	    	
        	    	// Invert the colors if requested
        	    	if( this.slideshow_invert_colors ){
        	    		this.invertDocumentColors(this.slideshow_window);
        	    		console.info("Inverted the colors successfully");
        	    	}
        	    	
        	    	// Hide the loading frame
        	    	setTimeout(function(){console.info("Hiding the loading frame"); this.hideLoadingFrame()}.bind(this), 2000);
        	       
        	    }
        	}.bind(this), 200);
        	
        	// Reset the time that the view was loaded
        	this.slideshow_view_loaded = this.getNowTime();
        	
        },
        
        /**
         * Get the current time in Unix epoch seconds.
         */
        getNowTime: function(){
        	return new Date().getTime() / 1000;
        },
        
        /**
         * Return the number of seconds the given view has been displayed.
         */
        getSecondsInView: function(){
        	return this.getNowTime() - this.slideshow_view_loaded;
        },
        
        /**
         * Execute the cycle of looking to determine if changes are necessary to the show.
         */
        executeSlideshowCycle: function(){;
        	
    		// If the window was closed, stop the show
    		if(!this.isSlideshowWindowDefined() || !this.slideshow_is_running){
    			console.info("Window was closed, show will stop");
    			this.stopShow();
    			return false;
    		}
    		else if(this.getSecondsInView() >= this.slideshow_delay){
    			this.goToNextView();
    		}
    		
    		// Set the progress
    		if( this.slideshow_progress_bar_created && this.isSlideshowWindowDefined() ){
    			NProgress.set( this.getSecondsInView() / this.slideshow_delay );
    		}
    		
        	// Schedule the next call
        	window.setTimeout( function(){
        		this.executeSlideshowCycle();
        	}.bind(this), this.interval);
    		
        },
        
        /**
         * Determine if a slideshow window exists and is defined.
         */
        isSlideshowWindowDefined: function(){
        	return this.slideshow_window !== null && this.slideshow_window !== undefined && !this.slideshow_window.closed;
        },
        
        /**
         * Note that the show has stopped
         */
        stopShow: function(){
        	
        	this.toggleStartButton(true);
        	
        	// Close the window if it has not been done so
        	if( this.isSlideshowWindowDefined() ){
	        	this.slideshow_window.close();
	        	this.slideshow_window = null;
	        	
	        	if($('#showframe').length > 0){
	        		$('#showframe').remove();
	        	}
        	}
        	
        	// Stop attempts to update the progress bar since the document it is associated with no longer exists
        	this.slideshow_progress_bar_created = false;
        	
        	// Indicate that the show isn't running anymore
        	this.slideshow_is_running = false;
        	
        	// Hide the loading and overlay control frames if it is shown
        	this.hideLoadingFrame();
        	this.hideOverlayControls(true);
        },
        
        /**
         * Add a stylesheet to the given document.
         */
        addStylesheet: function(filename, doc){
            var link_tag=doc.createElement("link");
            link_tag.setAttribute("rel", "stylesheet");
            link_tag.setAttribute("type", "text/css");
            link_tag.setAttribute("href", filename);
            doc.getElementsByTagName("head")[0].appendChild(link_tag);
        },
        
        /**
         * Parse the integer if it is valid; return NaN if it is not.
         */
        parseFloatIfValid: function(val){
        	
        	var floatRegex = /[0-9]+([.][0-9]+)?/;
        	
        	if( !floatRegex.test(val) ){
        		return NaN;
        	}
        	else{
        		return parseFloat(val);
        	}
        },
        
        /**
         * Get the list of available views.
         */
        retrieveViews: function(){
        	
        	// Prepare the arguments
            var params = new Object();
            params.output_mode = 'json';
            params.count = '-1';
            
            var uri = Splunk.util.make_url('/splunkd/services/data/ui/views');
            uri += '?' + Splunk.util.propToQueryString(params);
            
            // Fire off the request
            jQuery.ajax({
                url:         uri,
                type:        'GET',
                success: function(result) {
                	this.available_views = result.entry;
                	this._render();
                }.bind(this),
                error: function(jqXHR, textStatus){
                	alert("The list of views could not be loaded");
                }.bind(this)
            });
        
        },
        
        /**
         * Get the list of available apps.
         */
        retrieveApps: function(){
        	
        	// Prepare the arguments
            var params = new Object();
            params.output_mode = 'json';
            params.count = '-1';
            
            var uri = Splunk.util.make_url('/splunkd/services/apps/local');
            uri += '?' + Splunk.util.propToQueryString(params);
            
            // Fire off the request
            jQuery.ajax({
                url:         uri,
                type:        'GET',
                success: function(result) {
                	this.available_apps = result.entry;
                }.bind(this),
                error: function(jqXHR, textStatus){
                	alert("The list of apps could not be loaded");
                }.bind(this)
            });
        
        },
        
        /**
         * Render the page
         */
        render: function(){
        	
        	if( store && store.enabled ){
        		
        		// Stop the show until the user specifically requests starting it
        		store.set('in_slideshow', false );
        	}
        	else{
        		
        		this.$el.html('<h3>Local Storage Not Supported</h3>Local storage is not supported by the web browser; the slideshow will not function without it.' +
        				      'Local storage is not supported on older browsers (such as Internet Explorer 7 and earlier) or when browsers are in "private mode".<br /><br />' + 
        				      'See <a target="_blank" href="http://caniuse.com/namevalue-storage">more information</a> about browser compatibilty with local storage.');
        		return;
        	}
        	
        	// Get the list of views. This function will finish rendering the dialog.
        	this.retrieveViews();
        	
        	// Get the list of apps. We will need to make sure we don't forward the user to an app that is not visible.
        	this.retrieveApps();
        
        },
        
        /**
         * Show a dialog noting that the popup was blocked.
         */
        showPopupWasBlockedDialog: function(){
        	this.showHelp("Yikes! It looks like the popup window was blocked.<br /><br />Check your browser settings and update them if the show didn't appear.")
        },
        
        /**
         * Filter our views that are unsupported in the slide-shows.
         */
        filterUnsupportedViews: function(views){
        	
        	var supported_views = [];
        	
        	for( var i = 0; i < views.length; i++ ){
        		
        		// Don't include the setup view
        		if( views[i].name == "slideshow_setup" ){
        			continue;
        		}
        		
        		// Don't include invisible views
        		else if( !views[i].content.isVisible ){
        			continue;
        		}
        		
        		// Skip views that are just redirects
        		else if(views[i].content['eai:data'].indexOf('type="redirect"') >= 0){
        			continue;
        		}
        		
        		// View checks out, include it
        		else{
        			supported_views.push(views[i]);
        		}
        	}
        	
        	return supported_views;
        
        },
        
        /**
         * Retrieve the stored value from store.js
         */
        getStoredValueOrDefault: function( name, default_value ){
        	var stored_value = store.get(name);
        	
        	if(stored_value === undefined){
        		return default_value;
        	}
        	else{
        		return stored_value;
        	}
        },
        
        /**
         * Render the page after all of the information is ready.
         */
        _render: function(){
        	
        	// Try to load the views from local storage
        	var delay_readable = this.getStoredValueOrDefault('view_delay_readable', "");
        	var delay = this.getStoredValueOrDefault('view_delay', "");
        	var selected_views = this.getStoredValueOrDefault('views', []);
        	var load_app_resources = this.getStoredValueOrDefault('load_app_resources', true);
        	var hide_chrome = this.getStoredValueOrDefault('hide_chrome', false);
        	var invert_colors = this.getStoredValueOrDefault('invert_colors', false);

        	// Extract a list of just the view names
        	var selected_views_names = [];
    		
    		for( var c = 0; c < selected_views.length; c++){
    			selected_views_names.push(selected_views[c].name);
    		}
        	
        	// Render the HTML
        	this.$el.html(_.template(SlideshowSetupPageTemplate,{
        		available_views: this.filterUnsupportedViews(this.available_views),
        		delay: delay_readable,
        		selected_views: selected_views_names,
        		load_app_resources: load_app_resources,
        		hide_chrome: hide_chrome,
        		invert_colors: invert_colors
        	}) );
        	
        	// Convert the list into a nice dual-list
        	$('[name="views_list"]').bootstrapDualListbox( { 
        		bootstrap2Compatible : true,
        		nonselectedlistlabel: 'Available',
        	    selectedlistlabel: 'Included'
        	});
        }
    });
    
    return SlideshowSetupView;
});