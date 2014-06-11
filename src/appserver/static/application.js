

function addJavascript( filename, callback ){	
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

function addStylesheet( filename ){ 
    var link_tag=document.createElement("link");
    link_tag.setAttribute("rel", "stylesheet");
    link_tag.setAttribute("type", "text/css");
    link_tag.setAttribute("href", filename);
    document.getElementsByTagName("head")[0].appendChild(link_tag);
}

// Declare a function that will start the slideshow once all of the files are loaded
window.slideshowStarted = false;

var startSlideShowIfReady = function(){
	if( typeof store !== 'undefined' && typeof NProgress !== 'undefined' && typeof SplunkSlideshow !== 'undefined' && window.slideshowStarted == false){
		SplunkSlideshow.startShow();
		window.slideshowStarted = true;
	}
};

//Load store.js
addJavascript('../../../en-US/static/app/slideshow/contrib/store.min.js', startSlideShowIfReady);

// Load the nprogress plugin
addJavascript('../../../en-US/static/app/slideshow/contrib/nprogress/nprogress.js', startSlideShowIfReady);
addStylesheet('../../../en-US/static/app/slideshow/contrib/nprogress/nprogress.css');

//Load the Slideshow player
addJavascript('../../../en-US/static/app/slideshow/js/SlideshowPlayer.js', startSlideShowIfReady);
addStylesheet('../../../en-US/static/app/slideshow/css/SlideshowPlayer.css');

