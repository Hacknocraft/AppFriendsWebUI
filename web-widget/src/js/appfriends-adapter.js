import { xssEscape } from './utils.js';

const GLOBAL_HANDLER = 'GLOBAL_HANDLER';
const GET_MESSAGE_LIMIT = 20;

class AFAdapter {
  constructor() {
    this.af = window.af;
    this.channelListQuery = null;
    this.userListQuery = null;
  }

  reset() {
    this.channelListQuery = null;
    this.userListQuery = null;
    this.af.removeDialogHandler(GLOBAL_HANDLER, this);
  }

  isConnected() {
    return !!this.af.isLoggedIn();
  }

  connect(userId, nickname, action) {
    this.af.login(userId, nickname, (token, error) => {
      if (error) {
        console.error(error);
        return;
      }
      action();
    });
  }

  disconnect(action) {
    if(this.isConnected()) {
      this.af.logout(() => {
        action();
      });
    }
  }

  isCurrentUser(user) {
    return this.af.Session.currentUser().id == user.id;
  }

  /*
  Channel
   */
  getChannelList(action) {
    if (!this.channelListQuery) {
      this.channelListQuery = this.af.GroupChannel.createMyGroupChannelListQuery();
      this.channelListQuery.includeEmpty = true;
      this.channelListQuery.limit = 20;
    }
    if (this.channelListQuery.hasNext && !this.channelListQuery.isLoading) {
      this.channelListQuery.next(function(channelList, error) {
        if (error) {
          console.error(error);
          return;
        }
        action(channelList);
      });
    }
  }

  getCachedDialog(dialogID) {
    return this.af.getDialog(dialogID);
  }

  getDialogInfo(dialog, action) {
    // only need to fetch dialog info again if it's a private group or channel
    if (dialog.isPrivateGroupChat()) {
      this.af.Dialog.getDialogInfo(dialog.id, function(dialog, error) {
        if (error) {
          console.error(error);
          action(null, error);
          return;
        }
        action(dialog, null);
      });
    } else if (dialog.isPublicChannel()) {
      this.af.PublicChannel.getChannelInfo(dialog.id, function(channel, error) {
        if (error) {
          console.error(error);
          action(null, error);
          return;
        }
        action(channel, null);
      });
    } else {
      action(dialog, null);
    }
  }

  createNewChannel(userIds, action) {
    if (userIds.length == 1) {
      //private chat
      this.af.Dialog.createPrivateDialogWitUserID(userIds[0], function(channel){
        action(channel);
      });
    }
    else
    {
      this.af.Dialog.createGroupDialogWithMemberIDs(userIds, '', function(channel, error) {
        if (error) {
          console.error(error);
          return;
        }
        action(channel);
      });
    }

  }

  inviteMember(channel, userIds, action) {
    this.af.Dialog.inviteWithMemberIds(channel.id, userIds, (response, error) => {
      if (error) {
        console.error(error);
        return;
      }
      action();
    });
  }

  channelLeave(channel, action) {
    this.af.Dialog.leaveDialog(channel.id, (channel, error) => {
      if (error) {
        console.error(error);
        return;
      }
      action();
    });
  }

  /*
  Message
   */
  getTotalUnreadCount(action) {
    this.af.getTotalUnreadMessageCount((unreadCount) => {
      action(unreadCount);
    });
  }

  getMessageList(dialogSet, fromBeginning, action) {
    if (!dialogSet.query) {
      dialogSet.query = dialogSet.dialog.createPreviousMessageListQuery();
    }
    if (dialogSet.query.hasMore && !dialogSet.query.isLoading) {
      dialogSet.query.load(GET_MESSAGE_LIMIT, false, fromBeginning, function(messageList, error) {
        if (error) {
          console.error(error);
          return;
        }
        action(messageList);
      });
    } else {
      action(null);
    }
  }

  sendTextMessage(dialog, textMessage, action) {
    console.log("sendTextMessage");
    dialog.sendTextMessage(textMessage, '', false, [], (message, error) => {
      if (error) {
        console.error(error);
        return;
      }
      action(message);
    });
  }

  sendFileMessage(channel, file, action) {
    let thumbSize = [{'maxWidth': 160, 'maxHeight': 160}];
    channel.sendFileMessage(file, '', '', thumbSize, (message, error) => {
      if (error) {
        console.error(error);
        return;
      }
      action(message);
    });
  }

  /*
  User
   */
  getUserList(action) {
    if (!this.userListQuery) {
      this.userListQuery = this.af.User.createUserListQuery();
    }
    else
    {
      this.userListQuery.reset();
    }
    if (this.userListQuery.hasNext && !this.userListQuery.isLoading) {
      this.userListQuery.next((userList, error) => {
        if (error) {
          console.error(error);
          return;
        }
        action(userList);
      });
    }
  }

  /*
  Handler
   */
  createHandlerGlobal(...args) {
    let messageReceivedFunc = args[0];
    let dialogCreatedFunc = args[1];
    let dialogChangedFunc = args[2];
    let badgeChangedFunc = args[3];
    let userJoinFunc = args[4];
    let userLeftFunc = args[5];

    let DialogHandler = {
      onMessageReceived: (dialog, message) => {
        messageReceivedFunc(dialog, message);
      },
      onDialogCreated: (dialog) => {
        dialogCreatedFunc(dialog);
      },
      onDialogChanged: (dialog) => {
        dialogChangedFunc(dialog);
      },
      onBadgeUpdated: () => {
        badgeChangedFunc();
      },
      onUserJoined: (dialog, user) => {
        userJoinFunc(dialog, user);
      },
      onUserLeft: (dialog, user) =>
      {
        userLeftFunc(dialog, user);
      }
    };
    this.af.addDialogHandler(GLOBAL_HANDLER, DialogHandler);
  }

  /*
  Info
   */
  getNicknamesString(dialog) {
    if (dialog.title && dialog.title !== '') {
      return dialog.title;
    }
    let nicknameList = [];
    let currentUserId = this.af.Session.currentUserID;
    dialog.members.forEach(function(member) {
      if (member.userId != currentUserId) {
        nicknameList.push(xssEscape(member.username));
      }
    });
    return nicknameList.toString();
  }

  getDialogTitle(dialog, callback) {
    if (dialog.isPublicChannel()) {
      return callback(dialog.title);
    } else if (dialog.isPrivateGroupChat()) {
      if (dialog.title === '') {
        return `Untitled group, ${dialog.getMemberCount()} users`;
      } else {
        return dialog.title;
      }
    } else {
      // private one on one chat, we should try fetch the user info
      if (dialog.title === '') {
        this.af.User.findUserWithID(dialog.id, (user, error) => {
          if (user !== null) {
            dialog.title = user.username;
            return dialog.title;
          }
        });
      }
    }

    return dialog.title;
  }

  getMemberCount(dialog) {
    return dialog.getMemberCount();
  }

  getLastMessage(channel) {
    if (channel.lastMessage) {
      return channel.lastMessage.isUserMessage() ? channel.lastMessage.message : channel.lastMessage.name;
    }
    return '';
  }

  getMessageTime(time) {
    const months = [
      'JAN', 'FEB', 'MAR', 'APR', 'MAY',
      'JUN', 'JUL', 'AUG', 'SEP', 'OCT',
      'NOV', 'DEC'
    ];

    var _getDay = (val) => {
      let day = parseInt(val);
      if (day == 1) {
        return day + 'st';
      } else if (day == 2) {
        return day + 'en';
      } else if (day == 3) {
        return day + 'rd';
      } else {
        return day + 'th';
      }
    };

    var _checkTime = (val) => {
      return (+val < 10) ? '0' + val : val;
    };

    if (time) {
      const LAST_MESSAGE_YESTERDAY = 'YESTERDAY';
      var _nowDate = new Date();
      var _date = new Date(time);
      if (_nowDate.getDate() - _date.getDate() == 1) {
        return LAST_MESSAGE_YESTERDAY;
      } else if (_nowDate.getFullYear() == _date.getFullYear()
        && _nowDate.getMonth() == _date.getMonth()
        && _nowDate.getDate() == _date.getDate()) {
        return _checkTime(_date.getHours()) + ':' + _checkTime(_date.getMinutes());
      } else {
        return months[_date.getMonth()] + ' ' + _getDay(_date.getDate());
      }
    }
    return '';
  }

  getMessageReadReceiptCount(channel, message) {
    return channel.getReadReceipt(message);
  }

  getChannelUnreadCount(channel) {
    return channel.unreadMessageCount;
  }

}

export { AFAdapter as default };
