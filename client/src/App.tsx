import React, { useEffect, useState, useRef } from "react";
import { Layout, Row, Col, Input, Button, List, Modal } from "antd";
import { WalletSelector } from "@aptos-labs/wallet-adapter-ant-design";
import "@aptos-labs/wallet-adapter-ant-design/dist/index.css";
import { Aptos } from "@aptos-labs/ts-sdk";
import {
  useWallet,
  InputTransactionData,
} from "@aptos-labs/wallet-adapter-react";

const aptos = new Aptos();
const ROOM_ADDR =
  "0x5d7cc9fdb838a482a7f6a781fa4baee72f7c434cf1242300dc0e8e2d700e192e";
const CONTRACT_ADDR =
  "0xf7b036b6eb1dfadd1255f3aba0398b146e16f34aa510ee07b58439d0e80be211";

interface Event {
  sequence_number: number;
  creation_number: number;
  account_address: string;
  transaction_version: number;
  transaction_block_height: number;
  type_: string;
  data: any;
  event_index: number;
  indexed_type: string;
}

// Define the TypeScript type for a chat message
interface ChatMessage {
  type: string;
  sender: string;
  username: string;
  message: string;
  message_index: number;
}

function App() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [isModalVisible, setIsModalVisible] = useState<boolean>(true);
  const ws = useRef<WebSocket | null>(null);

  const joinRoom = async () => {
    if (!account || !username) return;
    const transaction: InputTransactionData = {
      data: {
        function: `${CONTRACT_ADDR}::chat_room::join_chat_room`,
        functionArguments: [ROOM_ADDR, username],
      },
    };

    try {
      const response = await signAndSubmitTransaction(transaction);
      await aptos.waitForTransaction({ transactionHash: response.hash });
    } catch (error: any) {
      setIsModalVisible(true);
    }
  };

  useEffect(() => {
    joinRoom();
  }, [account?.address]);

  // Initialize WebSocket connection
  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:12345/stream"); // Replace with your WebSocket URL
    ws.current.onopen = () => {
      console.log("connected");
      ws.current?.send(`type,add,${CONTRACT_ADDR}::chat_room::JoinedChatRoom`);
      ws.current?.send(`type,add,${CONTRACT_ADDR}::chat_room::SentMessage`);
      ws.current?.send(`type,add,${CONTRACT_ADDR}::chat_room::SentReaction`);
      ws.current?.send(`type,add,${CONTRACT_ADDR}::chat_room::LeftChatRoom`);
    };

    ws.current.onmessage = (event) => {
      const message: Event = JSON.parse(event.data);
      switch (message.type_) {
        case `${CONTRACT_ADDR}::chat_room::SentMessage`:
          console.log("Received message", message.data);
          setChatMessages((prevMessages) => [
            ...prevMessages,
            {
              type: "chat",
              sender: message.data.sender,
              username: message.data.username,
              message: message.data.message,
              message_index: message.data.message_index,
            },
          ]);
          break;
        case `${CONTRACT_ADDR}::chat_room::SentReaction`:
          console.log("Received reaction", message.data);
          setChatMessages((prevMessages) => [
            ...prevMessages,
            {
              type: "react",
              sender: message.data.sender,
              username: message.data.username,
              message: `${message.data.username} reacted to ${message.data.message}`,
              message_index: 0,
            },
          ]);
          break;
        case `${CONTRACT_ADDR}::chat_room::JoinedChatRoom`:
          console.log(`${message.data.username} joined the chat room`);
          break;
        case `${CONTRACT_ADDR}::chat_room::LeftChatRoom`:
          console.log(`${message.data.username} left the chat room`);
          break;
        default:
          break;
      }
    };
    return () => {
      ws.current?.close();
    };
  }, []);

  useEffect(() => {
    console.log("Current chatMessages state: ", chatMessages);
  }, [chatMessages]);

  // Function to send a chat message
  const sendMessage = async () => {
    if (!account) return;
    if (inputValue) {
      const transaction: InputTransactionData = {
        data: {
          function: `${CONTRACT_ADDR}::chat_room::send_chat`,
          functionArguments: [ROOM_ADDR, inputValue],
        },
      };

      try {
        const response = await signAndSubmitTransaction(transaction);
        await aptos.waitForTransaction({ transactionHash: response.hash });
      } catch (error: any) {
        console.log(error);
      }
      setInputValue(""); // Clear the input field after sending
    }
  };

  // Function to handle chat message click event
  const handleChatMessageClick = async (index: number, type: string) => {
    if (type !== "chat") return;
    const transaction: InputTransactionData = {
      data: {
        function: `${CONTRACT_ADDR}::chat_room::react_to_message`,
        functionArguments: [ROOM_ADDR, index],
      },
    };

    try {
      const response = await signAndSubmitTransaction(transaction);
      await aptos.waitForTransaction({ transactionHash: response.hash });
    } catch (error: any) {
      console.log(error);
    }
  };

  const handleOk = () => {
    if (username.trim()) {
      setIsModalVisible(false);
      joinRoom();
    } else {
      // Prompt the user for a username if the input is empty or contains only whitespace
      Modal.warning({
        title: "Invalid username",
        content: "Please enter a valid username.",
      });
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
  };

  return (
    <>
      <Modal
        title="Select a Username"
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        closable={false}
        footer={[
          <Button key="submit" type="primary" onClick={handleOk}>
            Enter Chat
          </Button>,
        ]}
      >
        <Input
          placeholder="Username"
          onChange={handleUsernameChange}
          value={username}
          onPressEnter={handleOk}
        />
      </Modal>
      <Layout>
        <Row align="middle">
          <Col span={5} offset={2}>
            <h1>Event Stream Demo</h1>
          </Col>
          <Col span={5}>
            <h1>Username: {username}</h1>
          </Col>
          <Col span={10} style={{ textAlign: "right" }}>
            <WalletSelector />
          </Col>
        </Row>
        <Layout.Content style={{ padding: "20px" }}>
          <List
            dataSource={chatMessages}
            renderItem={(item) => (
              <List.Item
                onClick={() =>
                  handleChatMessageClick(item.message_index, item.type)
                }
              >
                <List.Item.Meta
                  title={
                    item.type === "chat" ? (
                      item.username
                    ) : (
                      <img
                        src={`${process.env.PUBLIC_URL}/react.png`}
                        alt="React"
                        style={{ width: "24px", height: "24px" }}
                      />
                    )
                  }
                  description={item.message}
                />
              </List.Item>
            )}
          />
          <Row>
            <Col span={20}>
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your message here..."
              />
            </Col>
            <Col span={4}>
              <Button type="primary" onClick={sendMessage}>
                Send
              </Button>
            </Col>
          </Row>
        </Layout.Content>
      </Layout>
    </>
  );
}

export default App;
