$env:GIT_INDEX_FILE = ".git/hf_index"
git read-tree HEAD
git rm -rf --cached frontend
$tree = git write-tree
$commit = git commit-tree $tree -m "Deploy backend to Hugging Face"
git push huggingface "$($commit):refs/heads/main" --force
Remove-Item .git/hf_index
Write-Host "Deployed successfully to Hugging Face Space!"
