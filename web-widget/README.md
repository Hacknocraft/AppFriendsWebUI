# AppFriends JavaScript Widget Sample
This is a sample chat widget built using using the [AppFriends SDK](https://github.com/smilefam/SendBird-SDK-JavaScript). It can be used to add a functional chat widget to any website.  


## [Demo](https://github.com/Hacknocraft/AppFriendsWebUI)

You can try out a live demo from the link [here](https://github.com/Hacknocraft/AppFriendsWebUI). Click on the button at the bottom-right corner of the webpage to try out the widget. Choose any 'User ID' and 'Nickname' to log in and participate in chats.


## Setup
1. The `body` must have a `div` element whose id is `af_widget`.
  
```html
<body>
  <div id="af_widget"></div>
</body>
```

2. Import the [`AppFriends SDK`](https://github.com/smilefam/SendBird-SDK-JavaScript).  
3. Import the `widget.AppFriends.js` file.
```javascript
<script src="AppFriends.min.js"></script>
<script src="build/widget.AppFriends.js"></script>
```


## Advanced  
### Connect other APP or Channel  
If you want to connect other application, you need to change variable `appId` in `index.html`.

```html
...

  <script src="AppFriends.min.js"></script>
  <script src="build/widget.AppFriends.js"></script>
  <script>
    var appId = '<APP_ID>';
    var secret = '<SECRET>';
    sbWidget.start(appId, secret);
  </script>

</html>
```

### Start with User connect  
If you want to start this sample with user connect, you can using `startWithConnect()`.  

```html
...

  <script src="AppFriends.min.js"></script>
  <script src="build/widget.AppFriends.js"></script>
  <script>
    var appId = '<APP_ID>';
    var secret = '<SECRET>';
    var userId = '<USER_ID>';
    var nickname = '<NICKNAME>';
    
    afWidget.startWithConnect(
        appId,
        secret,
        userId,
        nickname
    );
  </script>

</html>
```


## File Structure
```
    |-- build
        |-- widget.AppFriends.js              - SendBird Widget Bundle file
    |-- node_modules
        |-- ...                             - (node packages)
    |-- src
        |-- js
            |-- elements  
                |-- elements.js             - elements root class
                |-- spinner.js              - spinner element
                |-- widget-btn.js           - widget button element
                |-- popup.js                - popup element
                |-- list-board.js           - channel list element
                |-- chat-section.js         - chat element
            |-- consts.js                   - const variables
            |-- utils.js                    - util functions
            |-- sendbird.js                 - sendbird functions
            |-- widget.js                   - widget functions
        |-- scss
            |-- mixins 
                |-- _border-radius.scss     - border radius mixin  
                |-- _box-shadow.scss        - box shadow mixin
                |-- _state.scss             - element state mixin
                |-- _transform.scss         - transform mixin
                |-- _reset.scss             - clean css mixin
            |-- _mixins.scss                - import mixin
            |-- _variables.scss             - css variables
            |-- _animation.scss             - animation
            |-- _icons.scss                 - icon 
            |-- widget.scss                 - main css  
|-- .eslintrc.js                            - lint setting 
|-- webpack.config.js                       - webpack setting 
|-- package.json                            - npm package 
|-- AppFriends.min.js                         - AppFriends SDK 
|-- index.html                              - sample file
|-- README.md
```
