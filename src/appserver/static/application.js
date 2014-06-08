

function addJavascript( filename ){	
	var head_tag = document.getElementsByTagName('head');
	var s = document.createElement("script");
	s.type = "text/javascript";
	s.src = filename;
	$("head").append(s);
}


// Load the Slideshow player
addJavascript('../../../static/app/slideshow/js/SlideshowPlayer.js');

//Load store.js
addJavascript('../../../static/app/slideshow/contrib/store.min.js');

SplunkSlideshow.startShow();