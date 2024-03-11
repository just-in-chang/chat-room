module chat_room::chat_room {
    use std::signer;
    use std::string::String;

    use aptos_framework::event;
    use aptos_std::smart_vector::{Self, SmartVector};

    /// A chat room already exists.
    const ECHAT_ROOM_ALREADY_EXISTS: u64 = 1;
    /// A chat room does not exist.
    const ECHAT_ROOM_DOES_NOT_EXIST: u64 = 2;
    /// A user already exists in the chat room.
    const EUSER_ALREADY_EXISTS: u64 = 3;
    /// A user does not exist in the chat room.
    const EUSER_DOES_NOT_EXIST: u64 = 4;

    struct ChatRoom has key {
        users: SmartVector<User>,
        messages: SmartVector<Message>,
    }

    struct User has drop, key, store {
        user_address: address,
        username: String,
    }

    struct Message has key, store {
        message: String,
        reacts: u64,
    }

    #[event]
    struct JoinedChatRoom has drop, store {
        sender: address,
        username: String,
    }

    #[event]
    struct SentMessage has drop, store {
        sender: address,
        username: String,
        message: String,
        message_index: u64,
    }

    #[event]
    struct SentReaction has drop, store {
        sender: address,
        username: String,
        message_index: u64,
    }

    #[event]
    struct LeftChatRoom has drop, store {
        sender: address,
        username: String,
    }

    public entry fun create_chat_room(sender: &signer) {
        assert!(!exists<ChatRoom>(signer::address_of(sender)), ECHAT_ROOM_ALREADY_EXISTS);

        let chat_room = ChatRoom {
            users: smart_vector::new(),
            messages: smart_vector::new(),
        };

        move_to(sender, chat_room);
    }

    inline fun get_user_index(chat_room: &ChatRoom, user_address: address): u64 {
        let i = 0;
        while (i < smart_vector::length(&chat_room.users)) {
            if (smart_vector::borrow(&chat_room.users, i).user_address == user_address) {
                break
            };
            i = i + 1;
        };
        i
    }

    public entry fun join_chat_room(sender: &signer, room_address: address, username: String) acquires ChatRoom {
        assert!(exists<ChatRoom>(room_address), ECHAT_ROOM_DOES_NOT_EXIST);

        let sender_address = signer::address_of(sender);
        let chat_room = borrow_global_mut<ChatRoom>(room_address);
        let user_index = get_user_index(chat_room, sender_address);
        assert!(user_index == smart_vector::length(&chat_room.users), EUSER_ALREADY_EXISTS);

        smart_vector::push_back(&mut chat_room.users, User {
            user_address: sender_address,
            username,
        });

        event::emit(JoinedChatRoom {
            sender: sender_address,
            username,
        });
    }

    public entry fun send_chat(sender: &signer, room_address: address, message: String) acquires ChatRoom {
        assert!(exists<ChatRoom>(room_address), ECHAT_ROOM_DOES_NOT_EXIST);

        let sender_address = signer::address_of(sender);
        let chat_room = borrow_global_mut<ChatRoom>(room_address);
        let user_index = get_user_index(chat_room, sender_address);
        assert!(user_index != smart_vector::length(&chat_room.users), EUSER_DOES_NOT_EXIST);

        smart_vector::push_back(&mut chat_room.messages, Message {
            message,
            reacts: 0,
        });

        let username = smart_vector::borrow(&chat_room.users, user_index).username;
        event::emit(SentMessage {
            sender: sender_address,
            username,
            message,
            message_index: smart_vector::length(&chat_room.messages) - 1,
        });
    }

    public entry fun react_to_message(sender: &signer, room_address: address, message_index: u64) acquires ChatRoom {
        assert!(exists<ChatRoom>(room_address), ECHAT_ROOM_DOES_NOT_EXIST);

        let sender_address = signer::address_of(sender);
        let chat_room = borrow_global_mut<ChatRoom>(room_address);
        let user_index = get_user_index(chat_room, sender_address);
        assert!(user_index != smart_vector::length(&chat_room.users), EUSER_DOES_NOT_EXIST);

        let message = smart_vector::borrow_mut(&mut chat_room.messages, message_index);
        message.reacts = message.reacts + 1;

        event::emit(SentReaction {
            sender: sender_address,
            username: get_username(room_address, sender_address),
            message_index,
        });
    }

    public entry fun leave_chat_room(sender: &signer, room_address: address) acquires ChatRoom {
        let sender_address = signer::address_of(sender);
        assert!(exists<ChatRoom>(room_address), ECHAT_ROOM_DOES_NOT_EXIST);

        let chat_room = borrow_global_mut<ChatRoom>(room_address);
        let user_index = get_user_index(chat_room, sender_address);
        assert!(user_index != smart_vector::length(&chat_room.users), EUSER_DOES_NOT_EXIST);

        let user = smart_vector::remove(&mut chat_room.users, user_index);
        event::emit(LeftChatRoom {
            sender: sender_address,
            username: user.username,
        });
    }
    
    #[view]
    public fun get_username(room_address: address, user_address: address): String acquires ChatRoom {
        assert!(exists<ChatRoom>(room_address), ECHAT_ROOM_DOES_NOT_EXIST);
        
        let chat_room = borrow_global<ChatRoom>(room_address);
        let user_index = get_user_index(chat_room, user_address);
        assert!(user_index != smart_vector::length(&chat_room.users), EUSER_DOES_NOT_EXIST);
        smart_vector::borrow(&chat_room.users, user_index).username
    }
}
