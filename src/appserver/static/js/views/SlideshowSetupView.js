require.config({
    paths: {
        text: "../app/slideshow/contrib/text",
        bootstrap_dualist: "../app/slideshow/contrib/bootstrap-duallist/jquery.bootstrap-duallistbox.min"
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
    "css!../app/slideshow/css/SlideshowSetupView.css",
    "bootstrap_dualist",
    "css!../app/slideshow/contrib/bootstrap-duallist/bootstrap-duallistbox.min.css",
], function(_, Backbone, mvc, $, SimpleSplunkView, FormUtils, DropdownInput, TextInput, SlideshowSetupPageTemplate){
	
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
        	"click .btn-save" : "save"
        },
        
        initialize: function() {
        	
        	// Apply the defaults
        	this.options = _.extend({}, this.defaults, this.options);
        	
        	this.available_views = null;
        },
        
        /**
         * Set the dialog such that it is showing saving progress.
         */
        showSaving: function(saving){
        	
        	if(saving){
        		$("#save", this.$el).text("Saving...");
            	$("#cancel", this.$el).attr("disabled", "true");
        	}
        	else{
        		$("#save", this.$el).text("Save");
            	$("#cancel", this.$el).attr("disabled", "false");
        	}
        	
        },
        
        /**
         * Show the warning message.
         */
        hideWarning: function(){
        	$('#warning-message', this.$el).hide();
        },
        
        /**
         * Show the warning message.
         */
        showWarning: function(message){
        	$('#warning-message-text', this.$el).text(message);
        	$('#warning-message', this.$el).show();
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
         * Validate the form values.
         */
        validate: function(){
        	
        	/*
            if(!this.parseIntIfValid(mvc.Components.get("risk_score").val())){
            	this.showWarning("The risk score must be a valid integer");
            	return false;
            }
            
            if(mvc.Components.get("risk_object").val() === "" ){
            	this.showWarning("The risk object must be defined");
            	return false;
            }
            
            if(mvc.Components.get("risk_object_type").val() === ""){
            	this.showWarning("The risk object type must be selected");
            	return false;
            }
            
            if(mvc.Components.get("risk_description").val() === ""){
            	this.showWarning("The risk description must be provided");
            	return false;
            }
            */
        	
            return true;
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
        	
        	this.$el.html(_.template(SlideshowSetupPageTemplate,{
        		available_views: this.available_views
        	}) );
        	
        	$('[name="views_list"]').bootstrapDualListbox( { 
        		bootstrap2Compatible : true,
        		nonselectedlistlabel: 'Available',
        	    selectedlistlabel: 'Included'
        	});
        }
    });
    
    return SlideshowSetupView;
});