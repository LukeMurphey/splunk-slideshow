================================================
Overview
================================================

A Splunk app that will flip between dashboards on an interval; useful for displaying content on informational big screens.


================================================
Configuring Slideshow
================================================

Open the view titled "setup a show" and configure the show. Once the show is configured, the selected views will be displayed accordingly.


================================================
Getting Support
================================================

Go to the following website if you need support:

     http://lukemurphey.net/projects/splunk-slideshow/wiki/Start_here


================================================
Change History
================================================

+---------+------------------------------------------------------------------------------------------------------------------+
| Version |  Changes                                                                                                         |
+---------+------------------------------------------------------------------------------------------------------------------+
| 0.5     | Initial release                                                                                                  |
|---------|------------------------------------------------------------------------------------------------------------------|
| 0.6     | Fixed issue where the dual-list plugin would not load sometimes                                                  |
|---------|------------------------------------------------------------------------------------------------------------------|
| 0.7     | Added option that will hide content that is unnecessary for viewing dashboards (controls, footer, etc)           |
|         | Fixed issue that prevented the app from working on Splunk 6.0                                                    |
|         | Added help that described why some views were not available in the list of available views                       |
|---------|------------------------------------------------------------------------------------------------------------------|
| 0.8     | Improved styling on the filtered text on the setup view                                                          |
|         | Added controls for pausing, stopping, fast forwarding or rewinding a show                                        |
|         | Added support for IE 8 and IE 9                                                                                  |
|---------|------------------------------------------------------------------------------------------------------------------|
| 1.0     | Fixed grammar issue on the setup view                                                                            |
|---------|------------------------------------------------------------------------------------------------------------------|
| 1.0.1   | Updated icon for Splunk 6.2                                                                                      |
|---------|------------------------------------------------------------------------------------------------------------------|
| 2.0     | Completely updated backend that adds support for more views and apps (such as Enterprise Security)               |
|         | Added ability to enter interval with units and use float values (like 1.5m for 1.5 minutes)                      |
|         | Added predefined selectable intervals                                                                            |
|---------|------------------------------------------------------------------------------------------------------------------|
| 2.1     | Added the ability to invert colors of the view in the show (to provide a dark theme)                             |
|         | Fixed exception the occurred when the show was stopped in Internet Explorer                                      |
|         | Scrollbars are now hidden when the "Hide controls" setting is enabled                                            |
|         | Fixed issue where the slideshow always opened in a new window                                                    |
|         | Removed support for the progress bar on Internet Explorer due to several issues when the window is closed        |
|---------|------------------------------------------------------------------------------------------------------------------|
| 2.2     | Employs a new approach to rendering the show views which:                                                        |
|         |   1) Eliminates the flashing that happens when a view is being switched                                          |
|         |   2) Eliminates the moving of controls, header and footer when controls are to be hidden                         |
|         |   3) Adds the ability to stop a show within the slide-show window                                                |
|---------|------------------------------------------------------------------------------------------------------------------|
| 2.2.1   | Added view and information to help explain why some views are not listed                                         |
|---------|------------------------------------------------------------------------------------------------------------------|
| 2.2.2   | Fixed issue where the bottom of some screens was not black even when the invert colors mode was on               |
|         | CSS and JS files are now minified to decrease load times                                                         |
|---------|------------------------------------------------------------------------------------------------------------------|
| 2.3     | Added controls for switching to the next or previous views                                                       |
|---------|------------------------------------------------------------------------------------------------------------------|
| 2.3.1   | Fixing memory leak                                                                                               |
|---------|------------------------------------------------------------------------------------------------------------------|
| 2.4     | Added ability to save slide-shows                                                                                |
|---------|------------------------------------------------------------------------------------------------------------------|
| 2.4.1   | Fixing error where the "save new show" button was disabled preventing users from making a new show               |
|---------|------------------------------------------------------------------------------------------------------------------|
| 2.4.2   | Fixing back button that failed to work                                                                           |
|---------|------------------------------------------------------------------------------------------------------------------|
| 2.4.2   | Making the app work on Splunk 6.5                                                                                |
|         | Updating icon to work with newer version of Splunk-base                                                          |
|---------|------------------------------------------------------------------------------------------------------------------|
| 2.5.0   | Updating the icon                                                                                                |
|         | Added support for loading custom URLs                                                                            |
+---------+------------------------------------------------------------------------------------------------------------------+
