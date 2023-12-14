import os
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import openai
import os
from dotenv import load_dotenv
import PyPDF2
from langchain.document_loaders import PyPDFLoader
from langchain.vectorstores import FAISS
from langchain.chat_models import ChatOpenAI
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.chains import RetrievalQA, ConversationalRetrievalChain
import requests
import time
# from langchain.memory import ConversationSummaryMemory

app = FastAPI()

# Set up COR middleware to allow all origins (*)
app.add_middleware(
    CORSMiddleware,
    allow_origins = ['*'],
    allow_credentials = True,
    allow_methods = ['*'],
    allow_headers = ['*'],
)

load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

data_folder_name = 'data'

class QuestionSchema(BaseModel):
    question: str

detected_text = ''
chat_history = []
qa_interface = None
conv_interface = None
memory = None
# Upload PDF file and save
@app.post('/upload')
async def Upload_PDF(file: UploadFile = File(...)):
    
    c_directory = os.getcwd()
    file_name = file.filename
    file_path = data_folder_name + '/' + file_name
    if not os.path.exists(data_folder_name):
        os.makedirs(data_folder_name)

    with open(file_path, 'wb') as buffer:
        buffer.write(await file.read())

    pdf_file_obj = open(file_path,'rb')
    pdf_reader = PyPDF2.PdfReader(pdf_file_obj)
    num_pages = len(pdf_reader.pages)
    

    for page_num in range(num_pages):
        page_obj = pdf_reader.pages[page_num]
        global detected_text
        detected_text += page_obj.extract_text() + '\n\n'
    
    pdf_file_obj.close()

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    texts = text_splitter.create_documents([detected_text])

    directory = 'index_store'
    vector_index = FAISS.from_documents(texts, OpenAIEmbeddings())
    vector_index.save_local(directory)

    retriever = vector_index.as_retriever(search_type='similarity', search_kwargs={'k':6})

    global qa_interface
    global conv_interface

    qa_interface = RetrievalQA.from_chain_type(llm=ChatOpenAI(), chain_type='stuff',
                                               retriever=retriever,
                                               return_source_documents=True)
    global memory
    # memory =  ConversationSummaryMemory()
    conv_interface = ConversationalRetrievalChain.from_llm(ChatOpenAI(temperature=0),
                                                           retriever=retriever
                                                        #    memory=memory,
                                                        #    verbose=True
                                                           )


@app.post('/ask')
async def Ask(question: str):
    # question = question.question

    # response = qa_interface(question)
    # rlt = response['result']

    response = conv_interface({"question": question, "chat_history": chat_history})
    rlt = response['answer']
    chat_history.append((question, rlt))
    # global memory
    # query = conv_interface.condense_question(question,memory.current_context)

    
    print(rlt)
    video_url = Generate_Avatar(rlt)


    return video_url

def Generate_Avatar(prompt: str):
    API_KEY = os.getenv('SYNTHESIA_API_KEY')
    url = 'https://api.synthesia.io/v2/videos'

    headers = {
        'Authorization': f'{API_KEY}',
        'Content-Type': 'application/json',
    }

    data = {
        "test": True,
        "input": [
            {
                "scriptText": "Hello, World! This is my first synthetic video, made with the Synthesia API!",
                "avatar": "anna_costume1_cameraA",
                "background": "green_screen"
            }
        ]
    }

    response = requests.post(url, headers=headers, json=data)

    VIDEO_ID = response.json()['id']

    url = f'https://api.synthesia.io/v2/videos/{VIDEO_ID}'

    headers = {
        'Authorization': f'{API_KEY}'
    }

    VIDEO_URL = ''
    while True:
        print('Video genration is in progress...')
        response = requests.get(url, headers=headers)

        # Check the response status code
        if response.status_code == 200:
            if response.json()['status'] == 'complete':
                VIDEO_URL = response.json()['download']        
                break
        
        time.sleep(10)

    
    
    return VIDEO_URL

