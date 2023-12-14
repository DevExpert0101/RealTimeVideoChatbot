import React, { useState } from "react";

function FileUpload() {

    
    async function handleFileUpload  () {
        try {

            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('http://localhost:3002/upload', {
                method: "POST",               
                body: formData,
            });
            
            if (response.ok) {
                console.log('successfully uploaded')
            } else {
                console.error('Error', response.statusText);
            }
        } catch (error) {
            console.error('Error', error);
        }
    };

    const [file, setFile] = useState(null);

    const handleFineChange = (event) => {
        setFile(event.target.files[0]);
    };

    return (
        <div className="App">
            {/* <form onSubmit={handleUpload}>
                <h1>Upload a file</h1>
                <input type="file" />
                <button type="submit">Upload</button>
            </form> */}
            <input type="file" onChange={handleFineChange} />
            <button onClick={handleFileUpload}>Upload File</button>
        </div>
    )
}

export default FileUpload;