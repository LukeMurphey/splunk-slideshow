var SplunkSlideshow = {};

SplunkSlideshow.timeSpent = 0;
SplunkSlideshow.isRunning = false;
SplunkSlideshow.intervalID = null;
SplunkSlideshow.delay = 60 * 1000;
SplunkSlideshow.interval = 500;
SplunkSlideshow.nextView = null;

/**
 * Start running a show if necessary.
 */
SplunkSlideshow.startShow = function(){
	 
	 if( !SplunkSlideshow.isOnSetupPage() && SplunkSlideshow.isRunningShow() ){
		 
		 SplunkSlideshow.scheduleNextView();
		 
		// Load the app specific resources
		 if( store.get('load_app_resources') ){
			 var current_view = SplunkSlideshow.getCurrentView();
			 
			 if( current_view ){
			 	SplunkSlideshow.loadAppResources(current_view.app);
			 }
		 }
	 }
}

/**
 * Indicates if the string ends with the sub-string
 */
SplunkSlideshow.stringEndsWith = function(str, suffix){
	 return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

/**
 * Determine if a show is supposed to be running
 */
SplunkSlideshow.isRunningShow = function(){
	 if( store.get('in_slideshow') === true ){
		 return true;
	 }
	 else{
		 return false;
	 }
}

/**
 * Determine if we are on the the slideshow setup page.
 */
SplunkSlideshow.isOnSetupPage = function(){
	 return SplunkSlideshow.stringEndsWith(window.location.pathname, "/slideshow_setup");
}

/**
 * Pause the countdown.
 */
SplunkSlideshow.pause = function(){
	 return SplunkSlideshow.isRunning = false;
}

/**
 * Un-pause the countdown.
 */
SplunkSlideshow.unpause = function(){
	 return SplunkSlideshow.isRunning = true;
}

/**
 * Do the next step in the countdown.
 */
SplunkSlideshow.doCountdown = function(){
	
	SplunkSlideshow.timeSpent += SplunkSlideshow.interval;
	
	// If it is time to change views, then do this now
	if( SplunkSlideshow.timeSpent >= SplunkSlideshow.delay){
		console.log("Changing to next view in show");
		document.location = SplunkSlideshow.nextView.name;
		NProgress.set(1.0);
		clearInterval(SplunkSlideshow.intervalID);
		return;
	}
	else{
		NProgress.set( (1.0 * SplunkSlideshow.timeSpent) / SplunkSlideshow.delay );
	}
}

/**
 * Get a reference to the current view.
 */
SplunkSlideshow.getCurrentView = function(){
	var i = this.getCurrentViewIndex();
	
	// Get the views in the show
	var views = store.get('views');
	
	if( i !== null ){
		return views[i];
	}
	else{
		return null;
	}
	
}

/**
 * Get the index of the current view in the list of available views.
 */
SplunkSlideshow.getCurrentViewIndex = function(){
	 
	 // Get the views in the show
	 var views = store.get('views');
	 
	 // Stop if no views are defined in the show
	 if( views === undefined ){
		 console.warn("No views are available in the slideshow");
		 return;
	 }
	 
	 // Determine what the current view is
	 var path_info = window.location.pathname.split( '/' );
	 var current_view = null;
	 
	 // Use last part of the path as the current view unless it is blank (which indicates a trailing slash exists)
	 if( path_info[path_info.length-1].length !== "" ){
		 current_view = path_info[path_info.length-1];
	 }
	 else{
		 current_view = path_info[path_info.length-2];
	 }
	 
	 // Find the next view
	 var index_of_current_view = null;
	 
	 for(var c = 0; c < views.length; c++){
		 if( views[c].name === current_view ){
			 index_of_current_view = c;
			 break;
		 }
	 }
	 
	 return index_of_current_view;
}

/**
 * Get the next view in the list to show.
 */
SplunkSlideshow.getNextView = function(){
	 
	 // Find the next view
	 var index_of_current_view = SplunkSlideshow.getCurrentViewIndex();
	 var index_of_next_view = null;
	 
	 if( index_of_current_view === null ){
		 return null;
	 }
	 
	 // Get the views in the show
	 var views = store.get('views');
	 
	 // If we are at the last entry in the list, then rotate to the first one
	 if( (index_of_current_view + 1) >= views.length){
		 index_of_next_view = 0;
	 }
	 
	 // Increment to the next view
	 else{
		 index_of_next_view = index_of_current_view + 1;
	 }
	 
	 // Return the view
	 return views[index_of_next_view];
}

/**
 * Schedule the opening of the next view.
 */
SplunkSlideshow.scheduleNextView = function(){
	 
	 // Get the next view in the list to show
	 var next_view = SplunkSlideshow.getNextView();
	 
	 // Stop if we couldn't find the next view
	 if( !next_view ){
		 return;
	 }
	 
	 // Store the next page to show
	 SplunkSlideshow.nextView = next_view;
	 
	 // Get the view delay
	 var delay = store.get('view_delay');
	 
	 // Default the view delay to 60 seconds
	 if( !delay ){
		 delay = 60;
	 }
	 
	 // Convert the delay to milliseconds and save the value
	 SplunkSlideshow.delay = delay * 1000;
	 
	 // Start the progress indicator
	 NProgress.configure({ showSpinner: false });
	 NProgress.set(0.0);
	 
	 // Setup the changing to the new view
	 SplunkSlideshow.intervalID = setInterval( function(){
		 SplunkSlideshow.doCountdown();
	 }.bind(this), SplunkSlideshow.interval );
}

/**
 * Load the given Javascript file.
 */
SplunkSlideshow.addJavascript = function( filename, callback ){	
	var script = document.createElement('script');
	script.setAttribute("type","text/javascript");
	script.setAttribute("src", filename);
	document.getElementsByTagName("head")[0].appendChild(script);
	
	if( callback ){
		script.onload = function(){
            callback();
        };
	}
}

/**
 * Load the given stylesheet file.
 */
SplunkSlideshow.addStylesheet = function( filename ){ 
    var link_tag=document.createElement("link");
    link_tag.setAttribute("rel", "stylesheet");
    link_tag.setAttribute("type", "text/css");
    link_tag.setAttribute("href", filename);
    document.getElementsByTagName("head")[0].appendChild(link_tag);
}

/**
 * Load the resources associated with the given app.
 */
SplunkSlideshow.loadAppResources = function(app){
	if( SplunkSlideshow.isViewSimpleXML() ){
		SplunkSlideshow.addJavascript("../../../static/app/" + app + "/dashboard.js");
		SplunkSlideshow.addStylesheet("../../../static/app/" + app + "/dashboard.css");
	}
	else{
		SplunkSlideshow.addJavascript("../../../static/app/" + app + "/application.js");
		SplunkSlideshow.addStylesheet("../../../static/app/" + app + "/application.css");
	}
}

/**
 * Return true of the view is defined using simple XML.
 */
SplunkSlideshow.isViewSimpleXML = function(){
	return document.getElementsByClassName('simplexml').length > 0;
}