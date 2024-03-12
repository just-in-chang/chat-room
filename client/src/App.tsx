import React, { useEffect, useState, useRef } from "react";
import { Layout, Row, Col, Input, Button, List, Modal } from "antd";
import { WalletSelector } from "@aptos-labs/wallet-adapter-ant-design";
import "@aptos-labs/wallet-adapter-ant-design/dist/index.css";
import { Aptos, ViewRequest } from "@aptos-labs/ts-sdk";
import {
  useWallet,
  InputTransactionData,
} from "@aptos-labs/wallet-adapter-react";

const aptos = new Aptos();
const ROOM_ADDR =
  "0x5d7cc9fdb838a482a7f6a781fa4baee72f7c434cf1242300dc0e8e2d700e192e";
const CONTRACT_ADDR =
  "0xd50d955258a24a801cea515ca94d58890852eba3d45796cce14819c2845f1b7e";

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
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
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

  const leaveRoom = async () => {
    if (!account || !username) return;
    const transaction: InputTransactionData = {
      data: {
        function: `${CONTRACT_ADDR}::chat_room::leave_chat_room`,
        functionArguments: [ROOM_ADDR],
      },
    };

    try {
      const response = await signAndSubmitTransaction(transaction);
      await aptos.waitForTransaction({ transactionHash: response.hash });
      setIsModalVisible(true);
      setUsername("");
    } catch (error: any) {
      setIsModalVisible(true);
    }
  };

  useEffect(() => {
    if (!account) return;
    const payload: ViewRequest = {
      function: `${CONTRACT_ADDR}::chat_room::get_username`,
      typeArguments: [],
      functionArguments: [ROOM_ADDR, account.address],
    };

    aptos
      .view<string[]>({ payload })
      .then((r) => setUsername(r[0]))
      .catch((_) => setIsModalVisible(true));
  }, [account?.address]);

  useEffect(() => {
    ws.current = new WebSocket("ws://35.226.192.229:12345/stream");
    // ws.current = new WebSocket("ws://localhost:12345/stream");
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
          if (message.data.room_address !== ROOM_ADDR) break;
          console.log(`${message.data.username} joined the chat room`);
          setChatMessages((prevMessages) => [
            ...prevMessages,
            {
              type: "join",
              sender: message.data.sender,
              username: message.data.username,
              message: `${message.data.username} has joined the chat room!`,
              message_index: 0,
            },
          ]);
          break;
        case `${CONTRACT_ADDR}::chat_room::LeftChatRoom`:
          if (message.data.room_address !== ROOM_ADDR) break;
          console.log(`${message.data.username} left the chat room`);
          setChatMessages((prevMessages) => [
            ...prevMessages,
            {
              type: "leave",
              sender: message.data.sender,
              username: message.data.username,
              message: `${message.data.username} has left the chat room!`,
              message_index: 0,
            },
          ]);
          break;
        default:
          break;
      }
    };
    return () => {
      ws.current?.close();
    };
  }, []);

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
        <Layout.Header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Row justify="space-between" align="middle" style={{ width: "100%" }}>
            <Col>
              <Button type="primary" onClick={leaveRoom}>
                Leave Room
              </Button>
            </Col>
            <Col flex="auto" style={{ textAlign: "center" }}>
              <h1 style={{ margin: 0, color: "white" }}>Event Stream Demo</h1>
            </Col>
            <Col>
              <WalletSelector />
            </Col>
          </Row>
        </Layout.Header>
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
                    ) : item.type === "react" ? (
                      <img
                        src={`${process.env.PUBLIC_URL}/react.png`}
                        alt="React"
                        style={{ width: "24px", height: "24px" }}
                      />
                    ) : (
                      "👋"
                    )
                  }
                  description={item.message}
                />
              </List.Item>
            )}
          />
          <Layout.Footer
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Row
              justify="space-around"
              align="middle"
              style={{ width: "100%" }}
            >
              <Col style={{ width: "80%" }}>
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
          </Layout.Footer>
        </Layout.Content>
      </Layout>
    </>
  );
}

export default App;
