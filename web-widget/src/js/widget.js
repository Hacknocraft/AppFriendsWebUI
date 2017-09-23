import WidgetBtn from './elements/widget-btn.js';
import ListBoard from './elements/list-board.js';
import ChatSection from './elements/chat-section.js';
import Popup from './elements/popup.js';
import Spinner from './elements/spinner.js';
import AFAdapter from './appfriends-adapter.js';
import { hide, show, addClass, removeClass, hasClass, getFullHeight, insertMessageInList, getLastItem, isEmptyString, xssEscape } from './utils.js';
import { className, TYPE_STRING, MAX_COUNT } from './consts.js';

const WIDGET_ID = 'af_widget';
const TIME_STRING_TODAY = 'TODAY';
const TIME_MESSAGE_TYPE = 'time';
const NEW_CHAT_BOARD_ID = 'NEW_CHAT';
const KEY_DOWN_ENTER = 13;
const KEY_DOWN_KR = 229;
const CHAT_BOARD_WIDTH = 300;
const ERROR_MESSAGE = 'Please create "af_widget" element on first.';
const ERROR_MESSAGE_SDK = 'Please import "AppFriends SDK" on first.';
const EVENT_TYPE_CLICK = 'click';

window.WebFontConfig = {
  google: { families: ['Lato:400,700'] }
};

class AFWidget {
  constructor() {
  }

  start(appId, secret) {
    if (!window.af) {
      console.error(ERROR_MESSAGE_SDK);
      return;
    }
    this._getGoogleFont();
    this.widget = document.getElementById(WIDGET_ID);
    if (this.widget) {
      document.addEventListener(EVENT_TYPE_CLICK, (event) => {
        this._initClickEvent(event)
      });
      this._init();
      this._start(appId, secret);
    } else {
      console.error(ERROR_MESSAGE);
    }
  }

  startWithConnect(appId, sercret, userId, nickname, callback) {
    if (!window.af) {
      console.error(ERROR_MESSAGE_SDK);
      return;
    }
    this._getGoogleFont();
    this.widget = document.getElementById(WIDGET_ID);
    if (this.widget) {
      document.addEventListener(EVENT_TYPE_CLICK, (event) => {
        this._initClickEvent(event)
      });
      this._init();
      this._start(appId, sercret);
      this._connect(userId, nickname, callback);
    } else {
      console.error(ERROR_MESSAGE);
    }
  }

  _initClickEvent(event) {
    var _checkPopup = function(_target, obj) {
      if (obj === _target || hasClass(_target, className.IC_MEMBERS) || hasClass(_target, className.IC_INVITE)) {
        return true;
      } else {
        var returnedCheck = false;
        for (var i = 0 ; i < obj.childNodes.length ; i++) {
          returnedCheck = _checkPopup(_target, obj.childNodes[i]);
          if (returnedCheck) break;
        }
        return returnedCheck;
      }
    };

    if (!_checkPopup(event.target, this.popup.memberPopup)) {
      this.closeMemberPopup();
    }
    if (!_checkPopup(event.target, this.popup.invitePopup)) {
      this.closeInvitePopup();
    }
  }

  _init() {
    this.spinner = new Spinner();
    this.widget.enableNewChatButton = false;
    this.widget.enableOptionButton = false;
    this.widget.enableNickName = false;

    this.widgetBtn = new WidgetBtn(this.widget);
    this.listBoard = new ListBoard(this.widget);

    this.chatSection = new ChatSection(this.widget);
    this.popup = new Popup();

    this.activeChannelSetList = [];
    this.extraChannelSetList = [];

    this.timeMessage = class TimeMessage {
      constructor(date) {
        this.time = date;
        this.type = TIME_MESSAGE_TYPE;
      }
      isTimeMessage() {
        return this.type == TIME_MESSAGE_TYPE;
      }
    };
  }

  _getGoogleFont() {
    var wf = document.createElement('script');
    wf.src = ('https:' == document.location.protocol ? 'https' : 'http') +
      '://ajax.googleapis.com/ajax/libs/webfont/1.5.18/webfont.js';
    wf.type = 'text/javascript';
    wf.async = 'true';
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(wf, s);
  }

  reset() {
    this.extraChannelSetList = [];
    for (var i = 0 ; i < this.activeChannelSetList.length ; i++) {
      let channelSet = this.activeChannelSetList[i];
      let targetBoard = this.chatSection.getChatBoard(channelSet.dialog.id);
      if (targetBoard) {
        this.chatSection.closeChatBoard(targetBoard);
      }
    }
    this.activeChannelSetList = [];
    this.closePopup();

    this.afadapter.reset();
    this.listBoard.reset();
    this.widgetBtn.reset();
  }

  responsiveChatSection(dialogID, isShow) {
    let _bodyWidth = document.getElementsByTagName('BODY')[0].offsetWidth - 360;
    let maxSize = parseInt(_bodyWidth / CHAT_BOARD_WIDTH);
    let currentSize = this.activeChannelSetList.length;
    if (currentSize >= maxSize) {
      let extraChannelSet = getLastItem(this.activeChannelSetList);
      if (extraChannelSet) {
        if (this.extraChannelSetList.indexOf(extraChannelSet.dialog.id) < 0) {
          this.extraChannelSetList.push(extraChannelSet.dialog.id);
        }
        let chatBoard = this.chatSection.getChatBoard(extraChannelSet.dialog.id);
        if (chatBoard) {
          this.chatSection.closeChatBoard(chatBoard);
        }
        this.removeChannelSet(extraChannelSet.dialog);
      }
      if (dialogID) {
        let idx = this.extraChannelSetList.indexOf(dialogID);
        if (idx > -1) {
          this.extraChannelSetList.splice(idx, 1);
        }
      }
      this.chatSection.setWidth(maxSize * CHAT_BOARD_WIDTH);
    } else {
      let popDialogID = this.extraChannelSetList.pop();
      if (popDialogID) {
        this._connectDialog(popDialogID, true);
        this.chatSection.setWidth((currentSize + 1) * CHAT_BOARD_WIDTH);
      } else {
        if (isShow) {
          currentSize += 1;
        }
        this.chatSection.setWidth(currentSize * CHAT_BOARD_WIDTH);
      }
    }
  }

  _start(appId, sercret) {
    this.af = window.af;
    this.af.initialize(appId, sercret);
    this.af.setLogLevel(1);
    this.af.setSyncStartTimestamp(Math.floor(Date.now() / 1000) - 3*24*3600);
    this.afadapter = new AFAdapter();

    this.popup.addCloseBtnClickEvent(() => {
      this.closePopup();
    });

    this.widgetBtn.addClickEvent(() => {
      this.af.isLoggedIn() ? this.listBoard.showChannelList() : this.listBoard.showLoginForm();
      this.toggleBoard(true);
      this.chatSection.responsiveSize(false, this.responsiveChatSection.bind(this));
    });

    this.listBoard.addNewChatClickEvent(() => {
      this.listBoard.hideLogoutBtn();

      var chatBoard = this.chatSection.createChatBoard(NEW_CHAT_BOARD_ID);
      this.responsiveChatSection(null, true);

      this.chatSection.createNewChatBoard(chatBoard);
      this.chatSection.addClickEvent(chatBoard.startBtn, () => {
        if (!hasClass(chatBoard.startBtn, className.DISABLED)) {
          addClass(chatBoard.startBtn, className.DISABLED);
          this.spinner.insert(chatBoard.startBtn);
          let selectedUserIds = this.chatSection.getSelectedUserIds(chatBoard.userContent);
          this.afadapter.createNewChannel(selectedUserIds, (channel) => {
            chatBoard.parentNode.removeChild(chatBoard);
            this._connectDialog(channel, true);
            this.listBoard.checkEmptyList();
          });
        }
      });
      this.spinner.insert(chatBoard.userContent);

      this.afadapter.getUserList((userList) => {
        this.spinner.remove(chatBoard.userContent);
        this.setUserList(chatBoard, userList);
      }, true);

      this.chatSection.addClickEvent(chatBoard.closeBtn, () => {
        this.chatSection.closeChatBoard(chatBoard);
        this.closePopup();
        this.responsiveChatSection();
      });
      hide(chatBoard.leaveBtn);
      hide(chatBoard.memberBtn);
      hide(chatBoard.inviteBtn);
    });

    this.listBoard.addMinimizeClickEvent(() => {
      this.listBoard.hideLogoutBtn();
      this.closePopup();
      this.toggleBoard(false);
      this.chatSection.responsiveSize(true, this.responsiveChatSection.bind(this));
    });

    this.listBoard.addLogoutClickEvent(() => {
      this.afadapter.disconnect(() => {
        this.afadapter.reset();
        this.toggleBoard(false);
        this.widgetBtn.toggleIcon(false);
        this.listBoard.setOptionEventLock(false);
        this.chatSection.reset();
        this.reset();
      });
    });

    this.listBoard.addLoginClickEvent(() => {

      function validateEmail(email) {
        var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(email);
      }

      if (!validateEmail(this.listBoard.getNickname()))
      {
        alert("Please enter valid email.")
        return;
      }

      if (!hasClass(this.listBoard.btnLogin, className.DISABLED)) {
        this.spinner.insert(this.listBoard.btnLogin);
        this.listBoard.enabledToggle(this.listBoard.btnLogin, false);
        this.listBoard.userId.disabled = true;
        this.listBoard.nickname.disabled = true;

        this._connect(this.listBoard.getUserId(), this.listBoard.getNickname());
      }
    });
    this.listBoard.addKeyDownEvent(this.listBoard.nickname, (event) => {
      if (event.keyCode == KEY_DOWN_ENTER) {
        this.listBoard.btnLogin.click();
      }
    });
  }

  _connect(userId, nickname, callback) {
    this.af.login(userId, nickname, (token, error) => {
      this.widgetBtn.toggleIcon(true);
      this.listBoard.showChannelList();
      this.spinner.insert(this.listBoard.list);
      this.getDialogsList();

      this.afadapter.createHandlerGlobal(
        this.messageReceivedAction.bind(this),
        this.dialogCreatedAction.bind(this),
        this.dialogUpdatedAction.bind(this),
        this.dialogBadgeUpdated.bind(this),
        this.dialogUserJoined.bind(this),
          this.dialogUserLeft.bind(this)
      )
    });
  }

  dialogUserJoined(dialog, user) {

  }

  dialogBadgeUpdated() {
    console.log("badge changed");
  }

  dialogUserLeft(dialog, user){
    console.log("dialogUserLeft %o %o", dialog, user);
    if (this.afadapter.isCurrentUser(user)) {
      let item = this.listBoard.getChannelItem(dialog.id);
      this.listBoard.list.removeChild(item);
      this.listBoard.checkEmptyList();
    } else {
      this.listBoard.setChannelTitle(dialog.id, this.afadapter.getDialogTitle(dialog));
      this.updateUnreadMessageCount(dialog);
      let targetChatBoard = this.chatSection.getChatBoard(dialog.id);
      if (targetChatBoard) {
        this.updateChannelInfo(targetChatBoard, dialog);
      }
    }
  }

  dialogUpdatedAction(dialog) {

    let target = this.listBoard.getChannelItem(dialog.id);
    if (!target) {
      this.listBoard.checkEmptyList();
      target = this.createDialogItem(dialog);
    }
    this.listBoard.addListOnFirstIndex(target);
    this.listBoard.setChannelLastMessage(dialog.id, xssEscape(dialog.lastMessageText));
    this.listBoard.setChannelLastMessageTime(dialog.id,
                                             this.afadapter.getMessageTime(dialog.lastMessageTime));
    this.listBoard.setChannelAvatar(dialog.id, dialog.getDialogImage());
    this.listBoard.setChannelTitle(dialog.id, this.afadapter.getDialogTitle(dialog));
    this.updateUnreadMessageCount(dialog);
  }

  dialogCreatedAction(dialog) {
    let target = this.listBoard.getChannelItem(dialog.id);
    if (!target) {
      this.listBoard.checkEmptyList();
      target = this.createDialogItem(dialog);
    }
    this.listBoard.addListOnFirstIndex(target);
  }

  // message received function
  messageReceivedAction(dialog, message) {
    console.log("message received");
    let target = this.listBoard.getChannelItem(dialog.id);
    if (!target) {
      this.listBoard.checkEmptyList();
      target = this.createDialogItem(dialog);
    }
    this.listBoard.addListOnFirstIndex(target);

    this.listBoard.setChannelLastMessage(dialog.id, xssEscape(message.text));
    this.listBoard.setChannelLastMessageTime(dialog.id, this.afadapter.getMessageTime(message.sentTime));
    this.listBoard.setChannelAvatar(dialog.id, dialog.getDialogImage());

    let targetBoard = this.chatSection.getChatBoard(dialog.id);
    if (targetBoard) {
      let dialogSet = this.getDialogSet(dialog.id);
      if (!this.checkIfMessageInDialogSet(dialogSet, message)) {
        let isBottom = this.chatSection.isBottom(targetBoard.messageContent, targetBoard.list);
        let lastMessage = getLastItem(dialogSet.message);
        dialogSet.message.push(message);
        this.setMessageItem(dialogSet.dialog, targetBoard, [message], false, isBottom, lastMessage);
        const SELF = this;
        this.afadapter.markAsRead(dialog, ()=>
        {
          SELF.updateUnreadMessageCount(dialog);
        });
      }
    }
    else {
      this.updateUnreadMessageCount(dialog);
    }
  }

  checkIfMessageInDialogSet(dialogSet, message) {

    for (var i=0; i<dialogSet.message.length; i+=1) {
      if (message.messageID === dialogSet.message[i].messageID) {
        return true;
      }
    }
    return false;
  }

  setUserList(target, userList) {
    let userContent = target.userContent;
    this.chatSection.createUserList(userContent);
    for (var i = 0 ; i < userList.length ; i++) {
      let user = userList[i];
      if (!this.afadapter.isCurrentUser(user)) {
        let item = this.chatSection.createUserListItem(user);
        this.chatSection.addClickEvent(item, () => {
          hasClass(item.select, className.ACTIVE) ? removeClass(item.select, className.ACTIVE) : addClass(item.select, className.ACTIVE);
          let selectedUserCount = this.chatSection.getSelectedUserIds(userContent.list).length;
          this.chatSection.updateChatTop(target, selectedUserCount > 9 ? MAX_COUNT : selectedUserCount.toString(), null);
          (selectedUserCount > 0) ? removeClass(target.startBtn, className.DISABLED) : addClass(target.startBtn, className.DISABLED);
        });
        userContent.list.appendChild(item);
      }
    }
    this.chatSection.addUserListScrollEvent(target, () => {
      this.afadapter.getUserList((userList) => {
        this.setUserList(target, userList);
      });
    });
  }

  getChannelList(action) {
    let _list = this.listBoard.list;
    const SELF = this;
    this.af.PublicChannel.fetchChannels((channelList, error) => {
      action();
    });
  }

  getDialogsList() {
    let _list = this.listBoard.list;
    let _spinner = this.spinner;
    const SELF = this;
    this.getChannelList(function() {
      SELF.af.Dialog.fetchAllDialogs((dialogList, error) => {
        _spinner.remove(_list);
        if (error === null) {
          dialogList.forEach((dialog) => {
            let item = SELF.createDialogItem(dialog);
            _list.appendChild(item);
          });
          SELF.listBoard.checkEmptyList();
        }
      });
    });
  }

  createDialogItem(dialog) {

    const dialogImage = dialog.getDialogImage();
    let item = this.listBoard.createChannelItem(
      dialog.id,
      dialogImage,
      this.afadapter.getDialogTitle(dialog),
      this.afadapter.getMessageTime(dialog.lastMessageTime),
      dialog.lastMessageText,
      0
    );

    this.listBoard.addChannelClickEvent(item, () => {
      this.closePopup();
      let channelID = item.getAttribute('data-channel-id');
      let openChatBoard = this.chatSection.getChatBoard(channelID);
      if (!openChatBoard) {
        var newChat = this.chatSection.getChatBoard(NEW_CHAT_BOARD_ID);
        if (newChat) {
          this.chatSection.closeChatBoard(newChat);
        }
        let dialog = this.afadapter.getCachedDialog(channelID);
        if (dialog !== null) {
          this._connectDialog(dialog);
        }
      }
    });
    return item;
  }

  closePopup () {
    this.closeMemberPopup();
    this.closeInvitePopup();
  }

  closeMemberPopup() {
    this.chatSection.removeMemberPopup();
    this.popup.closeMemberPopup();
  }

  closeInvitePopup() {
    this.chatSection.removeInvitePopup();
    this.popup.closeInvitePopup();
  }

  showChannel(dialogID) {
    this._connectDialog(dialogID, false);
  }

  _connectDialog(dialog, doNotCall) {
    if (typeof dialog === 'string') {
      dialog = this.afadapter.getCachedDialog(dialog);
    }

    let dialogID = dialog.id;
    var chatBoard = this.chatSection.createChatBoard(dialogID, doNotCall);
    if (!doNotCall) {
      this.responsiveChatSection(dialogID, true);
    }
    this.chatSection.addClickEvent(chatBoard.closeBtn, () => {
      this.chatSection.closeChatBoard(chatBoard);
      this.closePopup();
      this.removeChannelSet(dialogID);
      this.responsiveChatSection();
    });
    this.chatSection.addClickEvent(chatBoard.leaveBtn, () => {
      this.chatSection.addLeavePopup(chatBoard);
      this.chatSection.setLeaveBtnClickEvent(chatBoard.leavePopup.leaveBtn, () => {
        this.spinner.insert(chatBoard.leavePopup.leaveBtn);
        addClass(chatBoard.leavePopup.leaveBtn, className.DISABLED);
        let channelSet = this.getDialogSet(dialogID);
        if (channelSet) {
          this.afadapter.channelLeave(channelSet.dialog, () => {
            chatBoard.removeChild(chatBoard.leavePopup);
            removeClass(chatBoard.leavePopup.leaveBtn, className.DISABLED);
            chatBoard.leavePopup = null;
            chatBoard.closeBtn.click();
          });
        } else {
          this.chatSection.closeChatBoard(chatBoard);
        }
      });
    });
    this.chatSection.addClickEvent(chatBoard.memberBtn, () => {
      if (hasClass(chatBoard.memberBtn, className.ACTIVE)) {
        this.closeMemberPopup();
      } else {
        this.closeMemberPopup();
        this.closeInvitePopup();
        addClass(chatBoard.memberBtn, className.ACTIVE);
        let index = this.chatSection.indexOfChatBord(dialogID);
        this.popup.showMemberPopup(this.chatSection.self, index);
        let channelSet = this.getDialogSet(dialogID);
        this.popup.updateCount(this.popup.memberPopup.count, channelSet.dialog.members.length);
        for (var i = 0 ; i < channelSet.dialog.members.length ; i++) {
          let member = channelSet.dialog.members[i];
          let item = this.popup.createMemberItem(member, false, this.afadapter.isCurrentUser(member));
          this.popup.memberPopup.list.appendChild(item);
        }
      }
    });
    this.chatSection.addClickEvent(chatBoard.inviteBtn, () => {
      var _getUserList = (memberIds, loadmore) => {
        this.afadapter.getUserList((userList) => {
          if (!loadmore) {
            this.spinner.remove(this.popup.invitePopup.list);
          }
          for (var i = 0 ; i < userList.length ; i++) {
            let user = userList[i];
            if (memberIds.indexOf(user.id) < 0) {
              let item = this.popup.createMemberItem(user, true);
              this.popup.addClickEvent(item, () => {
                hasClass(item.select, className.ACTIVE) ? removeClass(item.select, className.ACTIVE) : addClass(item.select, className.ACTIVE);
                let selectedUserCount = this.popup.getSelectedUserIds(this.popup.invitePopup.list).length;
                this.popup.updateCount(this.popup.invitePopup.count, selectedUserCount);
                (selectedUserCount > 0) ? removeClass(this.popup.invitePopup.inviteBtn, className.DISABLED) : addClass(this.popup.invitePopup.inviteBtn, className.DISABLED);
              });
              this.popup.invitePopup.list.appendChild(item);
            }
          }
        }, true);
      };

      if (hasClass(chatBoard.inviteBtn, className.ACTIVE)) {
        this.closeInvitePopup();
      } else {
        this.closeInvitePopup();
        this.closeMemberPopup();
        addClass(chatBoard.inviteBtn, className.ACTIVE);
        let index = this.chatSection.indexOfChatBord(dialogID);
        this.popup.showInvitePopup(this.chatSection.self, index);
        this.spinner.insert(this.popup.invitePopup.list);
        let channelSet = this.getDialogSet(dialogID);
        let memberIds = channelSet.dialog.members.map((member) => {
          return member.id;
        });
        _getUserList(memberIds);

        this.popup.addClickEvent(this.popup.invitePopup.inviteBtn, () => {
          if (!hasClass(this.popup.invitePopup.inviteBtn, className.DISABLED)) {
            addClass(this.popup.invitePopup.inviteBtn, className.DISABLED);
            this.spinner.insert(this.popup.invitePopup.inviteBtn);
            let selectedUserIds = this.popup.getSelectedUserIds(this.popup.invitePopup.list);
            let channelSet = this.getDialogSet(dialogID);
            this.afadapter.inviteMember(channelSet.dialog, selectedUserIds, () => {
              this.spinner.remove(this.popup.invitePopup.inviteBtn);
              this.closeInvitePopup();
              this.listBoard.setChannelTitle(channelSet.dialog.id, this.afadapter.getNicknamesString(channelSet.dialog));
              this.updateChannelInfo(chatBoard, channelSet.dialog);
            });
          }
        });

        this.popup.addScrollEvent(() => {
          _getUserList(memberIds, true);
        });
      }
    });
    this.spinner.insert(chatBoard.content);

    this.afadapter.getDialogInfo(dialog, (fetchedDialog, error) => {
      this.spinner.remove(chatBoard.content);
      if (fetchedDialog === null) {
        console.log("fetched Dialog is null");
      }
      if (error === null) {
        this.updateChannelInfo(chatBoard, fetchedDialog);
        let dialogSet = this.getDialogSet(dialog);
        this.getMessageList(dialogSet, chatBoard, false, () => {
          this.chatScrollEvent(chatBoard, dialogSet);
        });
        const SELF = this;
        this.afadapter.markAsRead(fetchedDialog, ()=>{
          SELF.updateUnreadMessageCount(fetchedDialog);
        });
        let listItem = this.listBoard.getChannelItem(fetchedDialog.id);
        if (!listItem) {
          listItem = this.createDialogItem(fetchedDialog);
          this.listBoard.list.insertBefore(listItem, this.listBoard.list.firstChild);
        }

        if (dialog.type === 'i')
        {
          hide(chatBoard.leaveBtn);
          hide(chatBoard.memberBtn);
          hide(chatBoard.inviteBtn);
        }
        else
        {
          show(chatBoard.leaveBtn);
          show(chatBoard.memberBtn);
          show(chatBoard.inviteBtn);
        }


      }
    });
  }

  updateChannelInfo(target, channel) {
    this.chatSection.updateChatTop(
      target, this.afadapter.getMemberCount(channel), this.afadapter.getNicknamesString(channel)
    );
  }

  updateUnreadMessageCount(channel) {
    this.afadapter.getTotalUnreadCount((unreadCount) => {
      this.widgetBtn.setUnreadCount(unreadCount);
    });

    if (channel) {
      this.listBoard.setChannelUnread(channel.id, channel.unreadMessageCount);
    }
  }

  getMessageList(dialogSet, target, loadmore, scrollEvent) {
    this.afadapter.getMessageList(dialogSet, !loadmore, (messageList) => {
      if (messageList === null) {
        this.spinner.remove(target.content);
        return;
      }
      let messageItems = messageList.slice();
      let tempTime;
      for (var index = 0 ; index < messageList.length ; index++) {
        let message = messageList[index];
        loadmore ? dialogSet.message.unshift(message) : dialogSet.message.push(message);

        let time = this.afadapter.getMessageTime(message.sentTime);
        if (time.indexOf(':') > -1) {
          time = TIME_STRING_TODAY;
        }
        if (tempTime != time) {
          tempTime = time;
          insertMessageInList(messageItems, messageItems.indexOf(message), new this.timeMessage(time));
        }
      }

      let scrollToBottom = false;
      if (!loadmore) {
        if (tempTime != TIME_STRING_TODAY) {
          messageItems.push(new this.timeMessage(TIME_STRING_TODAY));
        }
        scrollToBottom = true;
        this.spinner.remove(target.content);
        this.chatSection.createMessageContent(target);
        this.chatSection.addFileSelectEvent(target.file, () => {
          let file = target.file.files[0];
          this.afadapter.sendFileMessage(dialogSet.dialog, file, (message) => {
            this.messageReceivedAction(dialogSet.dialog, message);
          });
        });
        this.chatSection.addKeyDownEvent(target.input, (event) => {
          if(event.keyCode == KEY_DOWN_KR) {
            this.chatSection.textKr = target.input.textContent;
          }

          if (event.keyCode == KEY_DOWN_ENTER && !event.shiftKey) {
            let textMessage = target.input.textContent || this.chatSection.textKr;
            if (!isEmptyString(textMessage.trim())) {
              this.afadapter.sendTextMessage(dialogSet.dialog, textMessage, (message) => {
                this.messageReceivedAction(dialogSet.dialog, message);
              });
            }
            this.chatSection.clearInputText(target.input, dialogSet.dialog.id);
            this.chatSection.textKr = '';
            dialogSet.dialog.endTyping();
          } else {
            dialogSet.dialog.startTyping();
          }
          this.chatSection.responsiveHeight(dialogSet.dialog.id);
        });
        this.chatSection.addKeyUpEvent(target.input, (event) => {
          let isBottom = this.chatSection.isBottom(target.messageContent, target.list);
          this.chatSection.responsiveHeight(dialogSet.dialog.id);
          if (event.keyCode == KEY_DOWN_ENTER && !event.shiftKey) {
            this.chatSection.clearInputText(target.input, dialogSet.dialog.id);
            if (isBottom) {
              this.chatSection.scrollToBottom(target.messageContent);
            }
          } else {
            let textMessage = target.input.textContent || this.chatSection.textKr;
            if (textMessage.length === 0) {
              dialogSet.dialog.endTyping();
            }
          }
        });
        this.chatSection.addPasteEvent(target.input, (event) => {
          var clipboardData;
          var pastedData;

          event.stopPropagation();
          event.preventDefault();

          clipboardData = event.clipboardData || window.clipboardData;
          pastedData = clipboardData.getData('Text');

          target.input.textContent += pastedData;
        });
      }
      if (scrollEvent) {
        scrollEvent();
      }

      this.setMessageItem(dialogSet.dialog, target, messageItems, loadmore, scrollToBottom);
    });
  }

  setMessageItem(dialog, target, messageList, loadmore, scrollToBottom, lastMessage) {

    let firstChild = target.list.firstChild;
    let addScrollHeight = 0;
    let prevMessage;
    let newMessage;
    if (lastMessage && messageList[0]) {
      prevMessage = lastMessage;
    }
    for (var i = 0 ; i < messageList.length ; i++) {
      let message = messageList[i];
      if (message.isTimeMessage && message.isTimeMessage()) {
        newMessage = this.chatSection.createMessageItemTime(message.time);
        prevMessage = null;
      } else if (message.isUserMessage() || message.isAttachmentMessage()){
        let isContinue = (prevMessage && prevMessage.sender) ? (message.sender.id === prevMessage.sender.id) : false;
        let isCurrentUser = this.afadapter.isCurrentUser(message.sender);
        let unreadCount = 0;
        newMessage = this.chatSection.createMessageItem(message, isCurrentUser, isContinue, unreadCount);
        prevMessage = message;
      } else if (message.isSystemMessage()) {
        newMessage = this.chatSection.createAdminMessageItem(message);
      }

      if (loadmore) {
        target.list.insertBefore(newMessage, firstChild);
        addScrollHeight += getFullHeight(newMessage);
      } else {
        target.list.appendChild(newMessage);
      }
    }

    if(loadmore) {
      target.messageContent.scrollTop = addScrollHeight;
    } else if (scrollToBottom) {
      this.chatSection.scrollToBottom(target.messageContent);
    }
  }

  chatScrollEvent(target, channelSet) {
    this.chatSection.addScrollEvent(target.messageContent, () => {
      if (target.messageContent.scrollTop == 0) {
        this.getMessageList(channelSet, target, true);
      }
    });
  }

  getDialogSet(dialog, isLast) {
    let isObject = true;
    if (typeof dialog === TYPE_STRING || dialog instanceof String) {
      isObject = false;
    }

    let dialogSet = this.activeChannelSetList.filter((obj) => {
      return isObject ? obj.dialog == dialog : obj.dialog.id == dialog;
    })[0];

    if (!dialogSet && isObject) {
      dialogSet = {
        'dialog': dialog,
        'query': dialog.createPreviousMessageListQuery(),
        'message': []
      };
      isLast ? this.activeChannelSetList.push(dialogSet) : this.activeChannelSetList.unshift(dialogSet);
    }

    return dialogSet;
  }

  removeChannelSet(dialog) {
    let isObject = true;
    if (typeof dialog === TYPE_STRING || dialog instanceof String) {
      isObject = false;
    }

    this.activeChannelSetList = this.activeChannelSetList.filter(function(obj) {
      return isObject ? obj.dialog != dialog : obj.dialog.id != dialog;
    });
  }

  toggleBoard(isShow) {
    if (isShow) {
      hide(addClass(removeClass(this.widgetBtn.self, className.FADE_IN), className.FADE_OUT));
      show(addClass(removeClass(this.listBoard.self, className.FADE_OUT), className.FADE_IN));
    } else {
      hide(addClass(removeClass(this.listBoard.self, className.FADE_IN), className.FADE_OUT));
      show(addClass(removeClass(this.widgetBtn.self, className.FADE_OUT), className.FADE_IN));
    }
  }
}

window.afWidget = new AFWidget();
