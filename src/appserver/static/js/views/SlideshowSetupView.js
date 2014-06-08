require.config({
    paths: {
        text: "../app/slideshow/contrib/text",
        bootstrap_dualist: "../app/slideshow/contrib/bootstrap-duallist/jquery.bootstrap-duallistbox.min",
        store: "../app/slideshow/contrib/store.min",
    },
	shim: {
	    'store': {
	    	exports: 'store'
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
         * Validate the form values.
         */
        validate: function(){
        	
        	// Make sure some views were selected
        	if( !$('[name="views_list"]', this.$el).val() ){
        		return false;
        	}
        	
        	return true;
        },
        
        startShow: function(){
        	
        	// Make sure the settings are valid
        	if( !this.validate() ){
        		//Show cannot be started, something doesn't validate
        		return false;
        	}
        	
        	var views = $('[name="views_list"]', this.$el).val();
        	
        	store.set('views', views );
        	store.set('view_delay', $('[name="delay"]').val() );
        	store.set('in_slideshow', true );
        	
        	// Start at the first page
        	document.location = views[0];
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
        	this.retrieveViews();
        
        },
        
        /**
         * Render the page after all of the information is ready.
         */
        _render: function(){
        	
        	// Try to load the views from local storage
        	var delay = store.get('view_delay');
        	var selected_views = store.get('views');
        	
        	// Setup the defaults
        	if(!delay){
        		delay = "";
        	}
        	
        	if(!selected_views){
        		selected_views = [];
        	}
        	
        	// Render the HTML
        	this.$el.html(_.template(SlideshowSetupPageTemplate,{
        		available_views: this.available_views,
        		delay: delay,
        		selected_views: selected_views
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