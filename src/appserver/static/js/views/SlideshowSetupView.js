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
    "slideshow_player",
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
        	'interval': 200
        },
        
        /**
         * Wire up the events
         */
        events: {
        	"click #start_show" : "startShow",
        	"click #stop_show" : "stopShow",
        	"click #help_dashboards_list" : "showDashboardsListHelp"
        },
        
        initialize: function() {
        	
        	// Apply the defaults
        	this.options = _.extend({}, this.defaults, this.options);
        	
        	this.interval = this.options.interval;
        	
        	this.available_views = null;
        	
        	// These variables are used for running the show and will be set when the show begins
        	this.slideshow_window = null;
        	this.slideshow_view_offset = null;
        	this.slideshow_views = null;
        	this.slideshow_delay = null;
        	this.slideshow_hide_chrome = null;
        	this.slideshow_time_spent = 0;
        	this.slideshow_progress_bar_created = false;
        	
        },
        
        showDashboardsListHelp: function(){
        	this.showHelp('<p>The dashboards listed for viewing are limited to those that this app can show in a slideshow. If a view is excluded in the list then most likely the permissions are set too restrictively. <a target="_blank" href="http://docs.splunk.com/Documentation/Splunk/latest/SearchTutorial/Aboutdashboards#Change_dashboard_permissions">Check the permissions</a> and modify them to share the dashboards with all apps.</p>' + 
        			      '<p>If you want to make a new view, then see the <a target="_blank" href="http://docs.splunk.com/Documentation/Splunk/latest/Viz/CreateandeditdashboardsviatheUI">Splunk documentation</a> for help.</p>');
        	
        	return false;
        },
        
        /**
         * Show the help dialog
         */
        showHelp: function(message_html){
        	$('#help-dialog-text', this.$el).html(message_html);
        	$('#help-dialog', this.$el).modal();
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
            failures += this.validateField( $('#delay_control_group'), $('[name="delay"]').val(), "Must be a valid integer of at least 1",
                    function(val){ 
                        return this.parseIntIfValid(val, 10) > 0 && this.parseIntIfValid(val, 10) < 100000;
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
         * Start the show.
         */
        startShowSameWindow: function(){
        	
        	// Make sure the settings are valid
        	if( !this.validate() ){
        		//Show cannot be started, something doesn't validate
        		return false;
        	}
        	
        	var selected_views = $('[name="views_list"]', this.$el).val();
        	var views = [];
        	
        	for( var c = 0; c < selected_views.length; c++){
        		
        		var view_meta = this.getViewForName(selected_views[c]);
        		
        		views.push({
        			'name' : selected_views[c],
        			'app'  : view_meta.acl.app
        		})
        	}
        	
        	store.set('views', views );
        	store.set('view_delay', $('[name="delay"]', this.$el).val() );
        	//store.set('load_app_resources', $('[name="load_app_resources"]:first', this.$el).prop("checked") );
        	store.set('hide_chrome', $('[name="hide_chrome"]:first', this.$el).prop("checked") );
        	store.set('in_slideshow', true );
        	
        	// Start at the first page
        	document.location = views[0].name;
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
        	
        	var delay = $('[name="delay"]', this.$el).val();
        	var hide_chrome = $('[name="hide_chrome"]:first', this.$el).prop("checked");
        	
        	// Save the settings
        	store.set('views', views );
        	store.set('view_delay', delay);
        	store.set('hide_chrome', hide_chrome);
        	
        	// Initialize the slideshow parameters so that we can run the show
        	this.slideshow_window = null;
        	this.slideshow_view_offset = 0;
        	this.slideshow_views = views;
        	this.slideshow_delay = delay;
        	this.slideshow_hide_chrome = hide_chrome;
        	
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
        	
        	// Make the window if necessary
        	if( this.slideshow_window === null ){
        		this.slideshow_window = window.open(view.name, "_blank", "toolbar=yes,fullscreen=yes,location=no,menubar=no,status=no,titlebar=no,toolbar=no,channelmode=yes");
        		//this.slideshow_window = window.open(view.name, "_blank", "toolbar=yes");
        	}
        	
        	// Otherwise, change the window
        	else{
        		
        		// Stop if the window was closed
        		if(this.slideshow_window === null || this.slideshow_window.closed){
        			console.info("Window was closed, show will stop");
        			return;
        		}
        		
        		this.slideshow_window.location = view.name;
        	}
        	
        	// Load the stylesheets and progress indicator as necessary when the page gets ready enough
        	var readyStateCheckInterval = setInterval(function() {
        		
        		//if (this.slideshow_window.document.getElementsByTagName('body')[0]) {
        		// Stop of the window is closed or null
        		if( this.slideshow_window.document === null || this.slideshow_window.document.closed ){
        			clearInterval(readyStateCheckInterval);
        			return;
        		}
        		
        		// See if the document is ready and update it if it is
        		if( this.slideshow_window.document.readyState === 'loaded'
        			|| this.slideshow_window.document.readyState === 'interactive'
        			|| this.slideshow_window.document.readyState === 'complete' ){
        			
        			// Load the CSS for the progress indicator
        			this.addStylesheet("../../../static/app/slideshow/contrib/nprogress/nprogress.css", this.slideshow_window.document);
        			
               	 	// Start the progress indicator
               	 	NProgress.configure({
               	 							showSpinner: false,
               	 							document: this.slideshow_window.document
               	 						});
               	 	
               	 	NProgress.set(0.0);
               	 	
               	 	this.slideshow_progress_bar_created = true;
        			
        	    	
        	    	// Hide the chrome if requested
        	    	if( this.slideshow_hide_chrome ){
        	    		this.addStylesheet("../../../static/app/slideshow/css/HideChrome.css", this.slideshow_window.document);
        	    		console.info("Successfully loaded the stylesheet for hiding chrome");
        	    	}
        	    	
        	    	// Were done
        	    	clearInterval(readyStateCheckInterval);
        	       
        	    }
        	}.bind(this), 3000);
        	
        },
        
        /**
         * Execute the cycle of looking to determine if changes are necessary to the show.
         */
        executeSlideshowCycle: function(){
        	
        	// Increment the timer
        	this.slideshow_time_spent += this.interval;
        	
    		// If the window was closed, stop the show
    		if(this.slideshow_window !== null && this.slideshow_window.closed){
    			console.info("Window was closed, show will stop");
    			this.stopShow();
    			return false;
    		}
    		else if(this.slideshow_time_spent >= (this.slideshow_delay * 1000)){
    			this.slideshow_time_spent = 0;
    			this.goToNextView();
    		}
    		
    		// Set the progress
    		if( this.slideshow_progress_bar_created ){
    			NProgress.set( (1.0 * this.slideshow_time_spent) / (this.slideshow_delay * 1000) );
    		}
    		
        	// Schedule the next call
        	window.setTimeout( function(){
        		this.executeSlideshowCycle();
        	}.bind(this), this.interval);
    		
    		
        },
        
        /**
         * Note that the show has stopped
         */
        stopShow: function(){
        	this.toggleStartButton(true);
        	this.slideshow_window.close();
        	this.slideshow_window = null;
        	
        	if( this.slideshow_progress_bar_created ){
        		NProgress.set(0.0);
        	}
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
        parseIntIfValid: function(val){
        	
        	var intRegex = /^[-]?\d+$/;
        	
        	if( !intRegex.test(val) ){
        		return NaN;
        	}
        	else{
        		return parseInt(val, 10);
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
        		
        		// Skip views that are not shared
        		else if( views[i].acl.sharing != "global" && views[i].acl.sharing != "system" ) {
        			continue;
        		}
        		
        		// Skip views that are known to not load dashboard.js or application.js
        		else if(views[i].content['eai:data'].indexOf('<view template="pages/app.html" type="html" isDashboard="False">') >= 0){
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
        	var delay = this.getStoredValueOrDefault('view_delay', "");
        	var selected_views = this.getStoredValueOrDefault('views', []);
        	var load_app_resources = this.getStoredValueOrDefault('load_app_resources', true);
        	var hide_chrome = this.getStoredValueOrDefault('hide_chrome', false);

        	// Extract a list of just the view names
        	var selected_views_names = [];
    		
    		for( var c = 0; c < selected_views.length; c++){
    			selected_views_names.push(selected_views[c].name);
    		}
        	
        	// Render the HTML
        	this.$el.html(_.template(SlideshowSetupPageTemplate,{
        		available_views: this.filterUnsupportedViews(this.available_views),
        		delay: delay,
        		selected_views: selected_views_names,
        		load_app_resources: load_app_resources,
        		hide_chrome: hide_chrome
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