var SplunkSlideshow = {};

/**
 * Start running a show if necessary.
 */
SplunkSlideshow.startShow = function(){
	 
	 if( !SplunkSlideshow.isOnSetupPage() && SplunkSlideshow.isRunningShow() ){
		 SplunkSlideshow.scheduleNextView();
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
 * Get the next view in the list to show.
 */
SplunkSlideshow.getNextView = function(){
	 
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
		 if( views[c] === current_view ){
			 index_of_current_view = c;
			 break;
		 }
	 }
	 
	 // If we are at the last entry in the list, then rotate to the first one
	 if( (index_of_current_view + 1) >= views.length){
		 index_of_current_view = 0;
	 }
	 else{
		 index_of_current_view++;
	 }
	 
	 // Return the view
	 return views[index_of_current_view];
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
	 
	 // Get the view delay
	 var delay = store.get('view_delay');
	 
	 // Default the view delay to 60 seconds
	 if( !delay ){
		 delay = 60;
	 }
	 
	 // Setup the changing to the new view
	 setTimeout( function(){
		 console.log("Changing to next view in show");
		 document.location = next_view;
	 }, 1000 * delay );
}