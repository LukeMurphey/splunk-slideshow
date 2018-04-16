/*
 * This view handles not only the creation of a slideshow but also the process of playing the show. Below is a summary of how some of the class functions.
 * 
 * ___________________________________________
 * How shows execute
 * 
 * Below is a list of the functions that are executed in order to run a show:
 * 
 *     startShow(): begins the process of executing a show
 *        |--- makeSavedShowConfig(): gets a config for executing the show
 *        |--- goToNextView(): gets the first page
 *               |--- changeView(): determines which view to show based on the contents of this.slideshow_views
 *               |--- makeViewURL(): makes the URL for the view to display
 *        |--- executeSlideshowCycle(): starts the slideshow cycle; will continue to call goToNextView() accordingly
 *     
 *     
 * ___________________________________________
 * How shows are loaded from the KV store   
 *    
 * Shows are loaded via the function loadSavedShow(). This function populates the UI. The UI is then used to make the show config when the show is started.
 * 
 * See the following for a description of the KV store collection schema: https://lukemurphey.net/projects/splunk-slideshow/wiki/Collection_Schema
 * 
 */


require.config({
    paths: {
        text: "../app/slideshow/contrib/text",
        optional: "../app/slideshow/contrib/optional",
        bootstrap_dualist: "../app/slideshow/contrib/bootstrap-duallist/jquery.bootstrap-duallistbox.min",
        store: "../app/slideshow/contrib/store.min",
        nprogress: "../app/slideshow/contrib/nprogress/nprogress",
        kvstore: "../app/slideshow/contrib/kvstore"
    },
	shim: {
	    'store': {
	    	exports: 'store'
	    },
    	'bootstrap_dualist': {
    		deps: ['jquery']
    	},
	    'nprogress': {
	    	exports: 'NProgress',
	    	deps: ['jquery']
	    },
	    'kvstore': {
	    	deps: ['jquery', 'backbone', 'underscore']
	    },
    	'bootstrap_dualist': {
    		deps: ['jquery']
    	}
	}
});

define([
    "underscore",
    "backbone",
    "splunkjs/mvc",
    "jquery",
    "collections/SplunkDsBase",
    "splunkjs/mvc/simplesplunkview",
    "splunkjs/mvc/simpleform/input/dropdown",
    "splunkjs/mvc/simpleform/input/text",
    "text!../app/slideshow/js/templates/SlideshowSetupPage.html",
    "store",
    "kvstore",
    "css!../app/slideshow/css/SlideshowSetupView.css",
    "bootstrap_dualist",
    "nprogress",
    "css!../app/slideshow/contrib/bootstrap-duallist/bootstrap-duallistbox.min.css",
], function(_, Backbone, mvc, $, SplunkDsBaseCollection, SimpleSplunkView, DropdownInput, TextInput, SlideshowSetupPageTemplate, store, KVStore){
	
	if(KVStore && KVStore.Model){
		var SavedSlideshowModel = KVStore.Model.extend({
		    collectionName: 'saved_slideshows'
		});
		
		var SavedSlideshowCollection = KVStore.Collection.extend({
		    collectionName: 'saved_slideshows',
		    model: SavedSlideshowModel
		});
	}

    // Define the custom view class
    var SlideshowSetupView = SimpleSplunkView.extend({
    	
        className: "SlideshowSetupView",

        /**
         * Setup the defaults
         */
        defaults: {
        	'interval': 500,
        	'use_iframe': true,
        	'custom_view_prefix': 'custom: '
        },
        
        /**
         * Wire up the events
         */
        events: {
        	"click #start_show" : "startShow",
        	"click #stop_show" : "stopShow",
        	"click .predefined-interval" : "setPredefinedInterval",
        	"click #overlay_stop_show": "stopShow",
        	"click #help_dashboards_list" : "showDashboardsListHelp",
        	"click #overlay_next_view" : "nextView",
        	"click #overlay_prev_view" : "previousView",
        	"click #delete_saved_show" : "deleteSavedShow",
        	"click #new_saved_show" : "newSavedShow",
        	"click #save_saved_show" : "editSavedShow",
        	"click #edit_saved_show_title" : "editSavedShowTitle",
        	"click #show_links" : "showShareLinks",
        	"click #link" : "selectLink",
        	"click #autoplay-link" : "selectAutoplayLink",
        	"click #add_custom_url" : "addCustomURL"
        },
        
        initialize: function() {
        	
        	// Apply the defaults
        	this.options = _.extend({}, this.defaults, this.options);
        	
        	this.interval = this.options.interval;
        	this.use_iframe = this.options.use_iframe;
        	this.custom_view_prefix = this.options.custom_view_prefix;
        	
        	this.available_views = null;
        	this.available_apps = null;
        	
        	// These variables are used for running the show and will be set when the show begins
        	this.slideshow_window = null;
        	this.slideshow_view_offset = null;
        	this.slideshow_views = null;
        	this.slideshow_delay = null;
        	this.slideshow_hide_chrome = null;
        	this.slideshow_view_loaded = null;
        	this.slideshow_view_ready = null;
        	this.slideshow_progress_bar_created = false;
        	this.slideshow_is_running = false;
			this.slideshow_invert_colors = false;
			this.slideshow_hide_progressbar = false;

        	this.hide_controls_last_mouse_move = null;
        	this.ready_state_check_interval = null;
        	
        	this.saved_shows_supported = false;
        	this.custom_urls = [];
        	
        	if(KVStore && KVStore.Model){
        		this.saved_shows_supported = true;
        		
	        	this.saved_shows_model = new SavedSlideshowCollection();
	        	this.saved_shows_model.on('reset', this.gotSavedShows.bind(this), this);
	        	
	        	// Start the loading of the saved shows
	        	this.saved_shows_model.fetch({
	                success: function() {
	                  console.info("Successfully retrieved the saved shows");
	                },
	                error: function() {
	                  console.error("Unable to fetch the saved slideshows");
	                  this.saved_shows_supported = false;
	                  this.hideSavedShowOptions();
	                }.bind(this),
	                complete: function(jqXHR, textStatus){
	                	if( jqXHR.status == 404){
	                		
	                		// We don't support saved shows (no KV support), hide the options
	                		this.hideSavedShowOptions();
	                		this.saved_shows_supported = false;
	                	}
	                }.bind(this)
	            });
        	}
        	else{
        		this.hideSavedShowOptions();
        	}
        	
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
        	                       ];
        	
        	// Keep links around to the controls
        	this.shows_dual_list = null;
        	this.shows_dropdown_input = null;
        	
        },
        
        /**
         * Show the help dialog
         */
        showHelp: function(message_html){
        	$('#help-dialog-text', this.$el).html(message_html);
        	$('#help-dialog', this.$el).modal();
        },
        
        /**
         * Hide the options for saving and loading shows.
         */
        hideSavedShowOptions: function(){
        	$('#saved_show_control_group', this.$el).hide();
        },
        
        /**
         * Add a custom URL to the show.
         */
        addCustomURL: function(){
        	
        	var url = prompt("Enter a URL to add to the show", "");
        	
        	// Stop if the user pressed cancel
        	if(url === null){
        		return;
        	}
        	
        	// Add the URL to the list
        	this.loadCustomURL(url, true);
        },
        
        /**
         * Generate the name of a custom URL.
         */
        generateCustomURLName: function(url){
        	return this.custom_view_prefix + url;
        },
        
        /**
         * Load the given URL in the show.
         */
        loadCustomURL: function(url, makeSelected, refresh){
        	
        	if(typeof makeSelected === 'undefined'){
        		var makeSelected = true;
        	}
        	
        	if(typeof refresh === 'undefined'){
        		var refresh = true;
        	}
        	
        	// Add the URL to the list
        	var name = this.generateCustomURLName(url);
        	this.custom_urls.push(url);
        	
        	// Make the parameters for the options element
        	var parameters = {
        			value:url,
        			text:name
        	}
        	
        	// Determine if the option should be selected
	        if(makeSelected){
	        	parameters['selected'] = 'selected'
	    	}
        	
        	$('#views_list').append($('<option>', parameters));
        	
        	if(refresh){
        		this.shows_dual_list.bootstrapDualListbox('refresh');
        	}
        },
        
        /**
         * Populate the list of saved shows.
         */
        gotSavedShows: function(){
        	this.refreshSavedShowsDropdown();
        },
        
        /**
         * Refresh the list of saved shows in the dropdown.
         */
        refreshSavedShowsDropdown: function(){
        	
        	// Update the dropdown with the saved shows
        	if(this.shows_dropdown_input){
        		this.shows_dropdown_input.settings.set("choices", this.getSavedShowsChoices());
        	}
        },
        
        /**
         * Get the list of saved shows.
         */
        getSavedShowsChoices: function(){
        	
        	// Populate the list of saved shows
        	var choices = [];
        	
        	for(var c = 0; c < this.saved_shows_model.models.length; c++){
        		
        		// Insert the entry
        		choices.push( {
        			'label': this.saved_shows_model.models[c].attributes.name,
        			'value': this.saved_shows_model.models[c].attributes._key
        		} );
        		
        	}
        	
        	return choices;
        },
        
        /**
         * Get a reference to the model of the selected show.
         */
        getSelectedShow: function(){
        	
        	var selected_key = this.shows_dropdown_input.val();
        	
        	if(selected_key){
        		return this.saved_shows_model.get(selected_key);
        	}
	        else{
	        	return null;
	        }
        },
        
        /**
         * Delete the selected saved show.
         */
        deleteSavedShow: function(){
        	
        	// Make sure a show was selected
        	var selected_key = this.shows_dropdown_input.val();
        	
        	var saved_show = this.getSelectedShow();
        	
        	// Remove the show
        	if(saved_show !== null){
        		saved_show.destroy({
        			success: function(model, response) {
        			  console.info("Saved show deleted");
        			  this.showMessage("Show successfully deleted");
        			  
        			  // Clear the selection
        			  this.shows_dropdown_input.val(null);
        			  this.refreshSavedShowsDropdown();
        			  
        			}.bind(this)
        		});
        	}
        	
        },
        
        /**
         * Create a new saved show.
         */
        newSavedShow: function(){
        	
        	// Make sure the settings are valid
        	if( !this.validate() ){
        		//Show cannot be started, something doesn't validate
        		return false;
        	}
        	
        	// Save the show (and select it once saved)
        	this.doSaveNewShow();
        },
        
        /**
         * Edit the saved show.
         */
        editSavedShow: function(){
        	
        	// Make sure a show was selected
        	// TODO
        	
        	// Make the changes
        	this.doEditShow();
        },
        
        /**
         * Load a saved show.
         */
        loadSavedShow: function(key){
        	
        	if(typeof key === 'undefined'){
        		return;
        	}
        	
        	console.info("Loading show with key=" + key);
        	
        	var saved_show = null;
        	var saved_show_name = null;
        	
        	for(var c = 0; c < this.saved_shows_model.models.length; c++){
        		if(this.saved_shows_model.models[c].attributes._key === key){
        			saved_show = this.saved_shows_model.models[c].attributes.configuration;
        			saved_show_name = this.saved_shows_model.models[c].attributes.name;
        		}
        	}
        	
        	if(saved_show !== null){
        		
	        	// Load the saved show info the form
	        	$('[name="delay"]', this.$el).val(saved_show.delay_readable);
	        	
	        	if(saved_show.hide_chrome){
	        		$('[name="hide_chrome"]:first', this.$el).prop("checked", true);
	        	}
	        	else{
	        		$('[name="hide_chrome"]:first', this.$el).prop("checked", false);
	        	}
	        	
	        	if(saved_show.invert_colors){
	        		$('[name="invert_colors"]:first', this.$el).prop("checked", true);
	        	}
	        	else{
	        		$('[name="invert_colors"]:first', this.$el).prop("checked", false);
	        	}

	        	if(saved_show.hide_progressbar){
	        		$('[name="hide_progressbar"]:first', this.$el).prop("checked", true);
	        	}
	        	else{
	        		$('[name="hide_progressbar"]:first', this.$el).prop("checked", false);
	        	}
	        	
	        	// Get a list of the options
	        	this.makeAllViewsUnselected();
	        	
	        	if(saved_show.views){
		        	for(var c = 0; c < saved_show.views.length; c++){
		        		
		        		// Handle the custom URL
		        		if(saved_show.views[c].url !== undefined){
		        			
		        			// Make sure the URL is in the list of custom URLs and add it
		        			if($.inArray(saved_show.views[c].url, this.custom_urls) < 0){
			        			this.loadCustomURL(saved_show.views[c].url, true, false);
		        			}
		        			
		        			// Otherwise, select it
		        			else{
		        				this.makeCustomURLSelected(saved_show.views[c].url);
		        			}
		        		}
		        		
		        		// Handle a normal Splunk view
		        		else{
			        		// Handle a Splunk view
			        		this.makeViewSelected(saved_show.views[c]);
		        		}
		        	}
	        	}
	        	
	        	this.shows_dual_list.bootstrapDualListbox('refresh');
        	}
        },
        
        /**
         * Make all views unselected.
         */
        makeAllViewsUnselected: function(){
        	$('[name="views_list"] > option').prop("selected", false);
        },
        
        /**
         * Make the given view selected.
         */
        makeViewSelected: function(view_name){
        	$('[name="views_list"] > option[value="' +  view_name.name + '"]').prop("selected", true);
        },
        
        /**
         * Make the given custom URL selected.
         */
        makeCustomURLSelected: function(url){
        	$('[name="views_list"] > option[value="' + url + '"]').prop("selected", true);
        },
        
        /**
         * Save an existing show.
         */
        doEditShow: function(){
        	
        	var saved_show = this.getSelectedShow();

        	if(saved_show){
            	saved_show.set({configuration: this.makeSavedShowConfig()});
            	
            	saved_show.save();
            	
            	this.refreshSavedShowsDropdown();
            	this.showMessage("Show successfully saved");
        	}
        },
        
        /**
         * Change the title of the show
         */
        editSavedShowTitle: function(){
        	
        	var saved_show = this.getSelectedShow();
        	
        	if(saved_show){
        		
            	var name = prompt("Enter the show name", saved_show.attributes.name);
            	
            	if (name != null) {
	            	saved_show.set({name: name});
	            	
	            	saved_show.save();
	            	
	            	this.refreshSavedShowsDropdown();
	            	this.showMessage("Title successfully changed");
            	}
        	}
        },
        
        /**
         * Save a new show.
         */
        doSaveNewShow: function(){
        	
        	var name = prompt("Enter the show name", "");
        	
            if (name != null) {
        	
	        	var saved_show = new SavedSlideshowModel({
	        		  name: name,
	        		  configuration: this.makeSavedShowConfig()
	        	});
	
	        	// Save the show and update the list
	        	saved_show.save().done(function(){
	        		this.saved_shows_model.push(saved_show);
	        		this.refreshSavedShowsDropdown();
	        		this.showMessage("Show successfully saved");
	        	}.bind(this))
	        	
            }
        	
        },
        
        /**
         * Set the status of the saved show controls to be enabled or disabled.
         */
        setStatusOfSavedShowControls: function(newValue){
        	if(newValue){
        		$('.saved-slideshow-controls > a:not(#new_saved_show)', this.$el).removeClass('disabled');
        		$('#show_links', this.$el).show();
        	}
        	else{
        		$('.saved-slideshow-controls > a:not(#new_saved_show)', this.$el).addClass('disabled');
        		$('#show_links', this.$el).hide();
        	}
        },
        
        /**
         * Make a config for the saved show.
         */
        makeSavedShowConfig: function(){
        	
        	// Make sure the settings are valid
        	if( !this.validate() ){
        		//Show cannot be started, something doesn't validate
        		return false;
        	}
        	
        	var saved_show = {};
        	
        	// Get the views put into a list
        	var selected_views = $('[name="views_list"]', this.$el).val();
        	var views = [];
        	
        	for( var c = 0; c < selected_views.length; c++){
        		
        		// See if this is a custom view
        		if($.inArray(selected_views[c], this.custom_urls) > -1){
        			
        			var custom_url = this.custom_urls[selected_views[c]];
        			
        			views.push({
	        			'url' : selected_views[c]
	        		});
        		}
        		
        		// Handle other views
        		else{
	        		// Get the view information
	        		var view_meta = this.getViewForName(selected_views[c]);
	        		
	        		// Add the view if it was found
	        		if(view_meta !== undefined){
		        		views.push({
		        			'name' : selected_views[c],
		        			'app'  : view_meta.acl.app
		        		});
	        		}
        		}
        	}
        	
        	saved_show.views = views;
        	
        	// Get the other parameters
        	var delay_readable = $('[name="delay"]', this.$el).val();
        	var delay = this.getSecondsFromReadableDuration( delay_readable );
        	var hide_chrome = $('[name="hide_chrome"]:first', this.$el).prop("checked");
			var invert_colors = $('[name="invert_colors"]:first', this.$el).prop("checked");
			var hide_progressbar = $('[name="hide_progressbar"]:first', this.$el).prop("checked");
        	
        	// Insert the parameters
        	saved_show.delay = delay;
        	saved_show.delay_readable = delay_readable;
        	saved_show.hide_chrome = hide_chrome;
        	saved_show.invert_colors = invert_colors;
        	saved_show.hide_progressbar = hide_progressbar;
        	
        	// Return the result
        	return saved_show;
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
         * Show the given message.
         */
        showMessage: function(message){
        	$('#message_holder', this.$el).show();
        	$('#message', this.$el).text(message);
        },
        
        /**
         * Hide the message.
         */
        hideMessage: function(message){
        	$('#message_holder', this.$el).hide();
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
        	
        	// Get a representation of the saved show
        	var saved_show = this.makeSavedShowConfig();
        	
        	if(saved_show === null){
        		// Stop, the show didn't validate
        	}
        	
        	// Save the settings
        	store.set('views', saved_show.views );
        	store.set('view_delay', saved_show.delay);
        	store.set('view_delay_readable', saved_show.delay_readable);
        	store.set('hide_chrome', saved_show.hide_chrome);
			store.set('invert_colors', saved_show.invert_colors);
			store.set('hide_progressbar', saved_show.hide_progressbar);
        	
        	// Initialize the slideshow parameters so that we can run the show
        	this.slideshow_window = null;
        	this.slideshow_view_offset = 0;
        	this.slideshow_views = saved_show.views;
        	this.slideshow_delay = saved_show.delay;
        	this.slideshow_hide_chrome = saved_show.hide_chrome;
			this.slideshow_invert_colors = saved_show.invert_colors;
			this.slideshow_hide_progressbar = saved_show.hide_progressbar;
        	
        	// Note that the show has begun
        	this.slideshow_is_running = true;
        	
        	// Open the window with the first view
        	this.goToNextView();
        	
        	// Start the process
        	this.executeSlideshowCycle();
        	
        	// Show the start button
        	this.toggleStartButton(false);
        	
        	// Hide the scrollbars on the main view
        	$("body").css('overflow', 'hidden');
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
        makeViewURL: function(view_meta, hide_controls, app){
        	
        	// Handle the case where this is a URL (which doesn't require special processing)
        	if(view_meta.url !== undefined){
        		return view_meta.url;
        	}
        	
        	var view = view_meta.name;
        	var app_to_use = null;
        	
        	if(view_meta.app !== undefined){
        		app_to_use = view_meta.app;
        	}
        	
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
        	
        	// If we have an app context, then use it 
        	if(app_to_use !== null){
        		url = "../" + app_to_use + "/" + view;
        	}
        	else{
        		url = Splunk.util.make_full_url(view);
        	}
        	
        	// TODO Only add the hide controls options if no options already exist
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
        	
    		$('#overlay-controls').show();
			$('#overlay-controls').animate({
				top: "0"
			});
			
        },
        
        /**
         * Hide the overlay controls
         */
        hideOverlayControls: function(dofast){
        	
        	// Provide a default argument
        	if(typeof dofast === 'undefined'){
        		dofast = false;
        	}
        	
        	if(dofast){
        		$('#overlay-controls').hide();
        	}
        	
			$('#overlay-controls').animate({
				top: "-100"
			}, function() {
				$('#overlay-controls').hide();
			});
        	
        },
        
        /**
         * Wire up the slide frame controls
         */
        wireUpSlideFrameControls: function(){
        	
        	try{
	        	// Remove existing bindings if necessary (to prevent memory leaks)
	        	if(this.slideshow_window && this.slideshow_window.document){
	        		$(this.slideshow_window.document).unbind();
	        		console.info("Unbound the overlay control handlers for the show frame");
	        	}
        	}
        	catch(DOMException){
        		// Ignore this exception. The window was likely displaying a page for another domain. 
        	}
        	
			// Store a reference to the window
			var showframe = document.getElementById("showframe");
			this.slideshow_window = showframe.contentWindow;
        	
        	// Wire up the handler to show the stop show option
        	setTimeout(function(){
        		
        		try{
        		
	        		// Handle the mouse moves in order to show the overlay
	            	$(this.slideshow_window.document).mousemove(function() {
	            		
	            		// Don't show the overlay controls within the first few seconds. We get some false mousemove events that occur when the views are swapped out.
	            		if( this.getSecondsReady() > 3 ){
	            			console.info("Mouse move detected; showing overlay controls");
	            			this.showOverlayControls();
	            		}
	            		
	                }.bind(this));
	            	
	            	console.info("Bound the overlay control handlers for the show frame");
	            	
	            	// Handle the keypresses to go to the next view
	            	$(this.slideshow_window.document).keydown(function(e) {
	            		
	            		// Go to the next view
	            		if(this.slideshow_is_running && e.keyCode === 39){
	            			console.info("Got a key-press to go to the next view");
	            			this.goToNextView();
	            		}
	            		
	            		// Go to the previous view
	            		else if(this.slideshow_is_running && e.keyCode === 37){
	            			console.info("Got a key-press to go to the previous view");
	            			this.goToPreviousView();
	            		}
	            		
	                }.bind(this));
            	
        		}
            	catch (DOMException){
            		// The browser blocked this because the page in the show is likely showing a page from another domain
            		console.info("The overlay control handlers for the show frame could not be loaded because the browser's security policy forbids it");
            	}
            	
        	}.bind(this), 2000);
        	
        },
        
        /**
         * This is a delay check to hide the overlay controls when necessary
         */
        hideControlsDelayCheck: function(){
        	//console.info("Checking controls: " + (new Date().getTime() - this.hide_controls_last_mouse_move).toString());
        	
        	if( $("#overlay_stop_show").is(":visible") ){
        		var delay = (new Date().getTime() - this.hide_controls_last_mouse_move);
        		
        		// If the overlay controls were open for 8 seconds or more, force the dialog closed. This is sometimes necessary because the browser was unable to get the chance to run the close animation.
	    		if( delay >= 8000 ){
	    			console.info("Hiding the overlay controls (forcefully)");
	    			this.hideOverlayControls(true);
	    		}
	    		
	    		// Otherwise, animate the dialog closure
	    		else if( delay >= 5000 ){
	    			console.info("Hiding the overlay controls");
	    			this.hideOverlayControls();
	    		}
        	}
    		
        },
        
        /**
         * Show the frame that will contain the slideshow
         */
        showSlideshowFrame: function(){
        	
        	// Remove the existing frame
        	this.deleteShowFrame();
        	
			// Make the frame if necessary
			if($('#showframe').length === 0){
				$('<iframe id="showframe">').appendTo('body');
				
				$(window).resize(function() {
					$('#showframe').css("height", $(window).height());
				});
			}
			
			$('#showframe').css("height", $(window).height());
			$('#showframe').show();
        	
			// Wire up the handler to hide the overlay controls
			this.wireUpSlideFrameControls();
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
        	    'background-color: #111;' +   
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
         * Delete the show frame.
         * 
         * This needs to be done in order to make sure that memory is re-claimed
         *  
         * See:
         *    1) http://lukemurphey.net/issues/1148
         * 	  2) https://github.com/LukeMurphey/splunk-slideshow/issues/1
         */
        deleteShowFrame: function(){
        	
        	// Unbind the overlay controls
        	if(this.slideshow_window && this.slideshow_window.document){
        		$(this.slideshow_window.document).unbind();
        	}
        	
        	// Purge the frame itself
        	if($('#showframe').length > 0){
        		$('#showframe').remove();
        	}
        	
        	this.slideshow_window = null;
        },
        
        /**
         * Go to the next view in the list.
         */
        goToNextView: function(){
        	this.changeView(true);
        },
        
        /**
         * Go to the previous view in the list.
         */
        goToPreviousView: function(){
        	this.changeView(false);
        },
        
        /**
         * Change to a view.
         */
        changeView: function(forward){
        	
        	// Provide a default argument for forward
        	if(typeof forward === 'undefined'){
        			forward = true;
        	}
        	
        	// Get the view that we are showing
        	var view = null;
        	
        	// If the view offset is undefined start at the beginning
        	if( this.slideshow_view_offset === null ){
        		this.slideshow_view_offset = 0;
        	}
        	else if(forward){
        		this.slideshow_view_offset++; 
        	}
        	else if(!forward){
        		this.slideshow_view_offset--; 
        	}
        	
        	// If the we went off of the end, then wrap around
        	if( this.slideshow_view_offset >= this.slideshow_views.length ){
        		this.slideshow_view_offset = 0;
        	}
        	else if( this.slideshow_view_offset < 0){
        		this.slideshow_view_offset = (this.slideshow_views.length - 1);
        	}

        	// Get the view
        	view = this.slideshow_views[this.slideshow_view_offset];
        	
        	if(view.hasOwnProperty("name")){
        		console.info("Changing to view: " + view.name);
        	}
        	else if(view.hasOwnProperty("url")){
        		console.info("Changing to URL: " + view.url);
        	}
        	else{
        		console.warn("View lacks a name and a url attribute");
        	}
        	
        	// Clear the existing interval
        	if(this.ready_state_check_interval){
        		clearInterval(this.ready_state_check_interval);
        		this.ready_state_check_interval = null;
        	}
        	
        	// Make the window if necessary
        	if( !this.slideshow_window ){
        		
        		// Make the window ...
        		if(!this.use_iframe){
        			this.slideshow_window = window.open(this.makeViewURL(view, this.slideshow_hide_chrome), "_blank");
        		}
        		
        		// ... or make the iframe
        		else{
        			
        			// Make the frame window
        			this.showSlideshowFrame();
        			
        			// Show the loading frame
        			this.showLoadingFrame();
        			
        			// Go to the first view
        			this.slideshow_window.location = this.makeViewURL(view, this.slideshow_hide_chrome);
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
        				
        				try{
        				
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
	        		    
        				} catch (DOMException){
        					
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
        		this.slideshow_window.location = this.makeViewURL(view, this.slideshow_hide_chrome);
        		
    			// Show the loading frame
    			this.showLoadingFrame();
    			
    			// Wire up the handlers to show/hide the overlap controls
    			this.wireUpSlideFrameControls();
        	}
        	
        	// Load the stylesheets and progress indicator as necessary when the page gets ready enough
        	this.ready_state_check_interval = setInterval(function() {
        		
        		try {
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
	        			if( !(this.isInternetExplorer() || this.slideshow_hide_progressbar) ){
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
	        	    	setTimeout(function(){
	        	    		console.info("Hiding the loading frame");
	        	    		this.hideLoadingFrame();
	        	    		this.slideshow_view_ready = this.getNowTime();
	        	    	}.bind(this), 2000);
	        	       
	        	    }
        		}
        		catch (DOMException){
        			clearInterval(this.ready_state_check_interval);
        			
    	    		console.info("Hiding the loading frame");
    	    		this.hideLoadingFrame();
    	    		this.slideshow_view_ready = this.getNowTime();
        		}
        		
        	}.bind(this), 200);
        	
        	// Reset the time that the view was loaded
        	this.slideshow_view_loaded = this.getNowTime();
        	this.slideshow_view_ready = null;
        	
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
         * Return the number of seconds the given view has been ready.
         */
        getSecondsReady: function(){
        	
        	if( this.slideshow_view_ready === null ){
        		return 0;
        	}
        	
        	return this.getNowTime() - this.slideshow_view_ready;
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
    		
    		// Hide the overlay if necessary
    		this.hideControlsDelayCheck();
    		
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
	        	
	        	this.deleteShowFrame();
        	}
        	
        	// Stop attempts to update the progress bar since the document it is associated with no longer exists
        	this.slideshow_progress_bar_created = false;
        	
        	// Indicate that the show isn't running anymore
        	this.slideshow_is_running = false;
        	
        	// Hide the loading and overlay control frames if it is shown
        	this.hideLoadingFrame();
        	this.hideOverlayControls(true);
        	
        	// Show the scrollbars on the main view
        	$("body").css('overflow', 'initial');
        },
        
        /**
         * Go to the next view
         */
        nextView: function(){
        	this.goToNextView();
        },
        
        /**
         * Go to the previous view
         */
        previousView: function(){
        	this.goToPreviousView();
        },
        
        /**
         * Handle key-presses to show the next view (or prior)
         */
        keydownOnView: function(e){
        	if(this.slideshow_is_running){
        		alert(e.which);
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
         * Show the dashboard help text.
         */
        showDashboardsListHelp: function(){
        	this.showHelp('<p>The dashboards listed for viewing are limited to those that this app can be shown in a slideshow. If a view is excluded in the list then most likely the permissions are set too restrictively. <a target="_blank" href="http://docs.splunk.com/Documentation/Splunk/latest/SearchTutorial/Aboutdashboards#Change_dashboard_permissions">Check the permissions</a> and modify them to share the dashboards with all apps.</p>' +
        				  '<p>If you want information regarding why a view is not listed, see <a target="_blank" href="slideshow_supportability">the view supportability dashboard</a> for more information.</p>' +
        			      '<p>If you want to make a new view, then see the <a target="_blank" href="http://docs.splunk.com/Documentation/Splunk/latest/Viz/CreateandeditdashboardsviatheUI">Splunk documentation</a> for help.</p>');
        	
        	return false;
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
         * Update the URL so that it points to the show.
         */
        updateURL: function(show_id){
        	if(show_id){
        		history.pushState({'show' : show_id}, "", "?show=" + show_id);
        	}
        	else{
        		history.pushState({'show' : show_id}, "", "?show=");
        	}
        },
        
        /**
         * Select the link.
         */
        selectLink: function(){
        	$('#link', this.$el).select();
        },
        
        /**
         * Select the auto-play link.
         */
        selectAutoplayLink: function(){
        	$('#autoplay-link', this.$el).select();
        },
        
        /**
         * Show a dialog for sharing a link.
         */
        showShareLinks: function(){
        	
        	$('#link', this.$el).val(document.location.href);
        	$('#autoplay-link', this.$el).val(document.location.href + "&autoplay=1");
        	
        	$('#link-dialog', this.$el).modal();
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
			var hide_progressbar = this.getStoredValueOrDefault('hide_progressbar', false);

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
        		saved_shows_supported: this.saved_shows_supported,
        		load_app_resources: load_app_resources,
        		hide_chrome: hide_chrome,
        		invert_colors: invert_colors,
        		hide_progressbar: hide_progressbar
        	}) );
        	
        	// Convert the list into a nice dual-list
        	this.shows_dual_list = $('[name="views_list"]').bootstrapDualListbox( { 
        		bootstrap2Compatible : true,
        		nonselectedlistlabel: 'Available',
        	    selectedlistlabel: 'Included'
        	});
        	
        	if(this.saved_shows_supported){
        	
	        	// Make the saved shows selection drop-down
	            this.shows_dropdown_input = new DropdownInput({
	                "id": "existing_shows",
	                "selectFirstChoice": false,
	                "showClearButton": true,
	                "el": $('#existing_shows', this.$el),
	                "choices": this.getSavedShowsChoices(),
	                "valueField": "show",
	                "value": "$show$"
	            }, {tokens: true}).render();
	            
	            this.shows_dropdown_input.on("change", function(newValue) {
	            	this.loadSavedShow(newValue);
	            	this.setStatusOfSavedShowControls(newValue);
	            	
		            // Auto-run the show if necessary
		            if(window.location.search.indexOf("autoplay") > -1 && newValue){
		            	this.startShow();
		            }
		            
		            this.updateURL(newValue);
		            
	            	
	            }.bind(this));
            
        	}
        }
    });
    
    return SlideshowSetupView;
});
