require.config({
    paths: {
        text: "../app/slideshow/contrib/text",
        bootstrap_dualist: "../app/slideshow/contrib/bootstrap-duallist/jquery.bootstrap-duallistbox.min",
        store: "../app/slideshow/contrib/store.min",
    },
	shim: {
	    'store': {
	    	exports: 'store'
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
    "splunkjs/mvc/simplesplunkview",
    "splunkjs/mvc/simpleform/formutils",
    "splunkjs/mvc/simpleform/input/dropdown",
    "splunkjs/mvc/simpleform/input/text",
    "text!../app/slideshow/js/templates/SlideshowSetupPage.html",
    "store",
    "css!../app/slideshow/css/SlideshowSetupView.css",
    "bootstrap_dualist",
    "css!../app/slideshow/contrib/bootstrap-duallist/bootstrap-duallistbox.min.css",
], function(_, Backbone, mvc, $, SimpleSplunkView, FormUtils, DropdownInput, TextInput, SlideshowSetupPageTemplate, store){
	
    // Define the custom view class
    var SlideshowSetupView = SimpleSplunkView.extend({
    	
        className: "SlideshowSetupView",

        /**
         * Setup the defaults
         */
        defaults: {
        	
        },
        
        /**
         * Wire up the events
         */
        events: {
        	"click #start_show" : "startShow"
        },
        
        initialize: function() {
        	
        	// Apply the defaults
        	this.options = _.extend({}, this.defaults, this.options);
        	
        	this.available_views = null;
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
        startShow: function(){
        	
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
        	store.set('load_app_resources', $('[name="load_app_resources"]:first', this.$el).prop("checked") );
        	store.set('hide_chrome', $('[name="hide_chrome"]:first', this.$el).prop("checked") );
        	store.set('in_slideshow', true );
        	
        	// Start at the first page
        	document.location = views[0].name;
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
        		
        		// Don't include invisible views
        		if( !views[i].content.isVisible ){
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